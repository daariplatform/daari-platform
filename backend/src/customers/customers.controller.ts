import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CACHE_MANAGER, CacheTTL } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { UserScopedCacheInterceptor } from '../cache/user-scoped-cache.interceptor';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { CustomerStatus, LocationSource, UserRole } from '@prisma/client';
import { CustomersService } from './customers.service';
import { BulkImportService } from './bulk-import.service';
import { AuthService } from '../auth/auth.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireCapability } from '../common/decorators/capabilities.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PaginationDto } from '../common/dto/pagination.dto';

class CreateCustomerDto {
  @IsString() @MinLength(2)
  fullName!: string;

  @Matches(/^07\d{9}$/)
  phone!: string;

  @IsOptional() @Matches(/^07\d{9}$/)
  whatsapp?: string;

  @IsString()
  district!: string;

  @IsString()
  addressLine!: string;

  @IsOptional() @IsLongitude()
  locationLng?: number;

  @IsOptional() @IsLatitude()
  locationLat?: number;

  /** If omitted the backend generates a random 6-char password. */
  @IsOptional() @IsString() @MinLength(6)
  password?: string;
}

class ResetPasswordDto {
  /** Plant admin can force-set a new password, or omit to auto-generate. */
  @IsOptional() @IsString() @MinLength(6)
  password?: string;
}

class CaptureLocationDto {
  @IsLongitude() lng!: number;
  @IsLatitude() lat!: number;
  @IsEnum(LocationSource) source!: LocationSource;
}

class MoveDto {
  @IsLongitude() newLng!: number;
  @IsLatitude() newLat!: number;
}

/**
 * Driver-onboarded customer — sent from mobile-worker when a driver signs
 * up a new household at the door. Same fields as CreateCustomerDto but
 * with mandatory GPS (the driver IS there, so we record it) and an
 * optional notes field. The backend stamps `onboardedByDriverId` from
 * the current user.
 */
class RegisterByDriverDto {
  @IsString() @MinLength(2)
  fullName!: string;

  @Matches(/^07\d{9}$/)
  phone!: string;

  @IsString()
  district!: string;

  @IsString()
  addressLine!: string;

  @IsLongitude() locationLng!: number;
  @IsLatitude() locationLat!: number;

  @IsOptional() @IsString()
  notes?: string;
}

/**
 * Public self-signup lead — the prospect downloaded the customer app, ran
 * /tenants/discover, picked a plant, and now submits their info. We trust
 * the OTP verification done at /auth/signup/verify-otp (15 min ago max).
 */
class CustomerLeadDto {
  @IsString() @MinLength(2)
  fullName!: string;

  @Matches(/^07\d{9}$/)
  phone!: string;

  @IsString()
  tenantId!: string;

  @IsString()
  district!: string;

  @IsString()
  addressLine!: string;

  @IsLongitude() locationLng!: number;
  @IsLatitude() locationLat!: number;
}

@ApiBearerAuth()
@ApiTags('customers')
@UseGuards(RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(
    private customers: CustomersService,
    private bulkImport: BulkImportService,
    private auth: AuthService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  /**
   * Public self-signup lead. The prospect already passed OTP at
   * /auth/signup/verify-otp (we re-check that here, max 15 min ago).
   * Customer row created in PENDING_APPROVAL state for the chosen plant.
   * Plant admin sees it in the dashboard and approves to start tank delivery.
   */
  @Public()
  @Post('lead')
  async submitLead(@Body() dto: CustomerLeadDto) {
    const ok = await this.auth.wasSignupOtpVerifiedRecently(dto.phone);
    if (!ok) {
      throw new UnauthorizedException(
        'يجب التحقّق من رقم الهاتف عبر الكود قبل إرسال الطلب',
      );
    }
    return this.customers.submitSelfLead(dto);
  }

  // ────────────────────────────────────────────────────────────
  // 📥 Bulk import (Excel) — قالب + معاينة + تنفيذ
  // ────────────────────────────────────────────────────────────

  /** يحمّل قالب Excel فارغ للمعمل ليملأ بيانات زبائنه. */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Get('import/template')
  async importTemplate(@Res() res: Response) {
    const buffer = await this.bulkImport.generateTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="daari-customers-template.xlsx"',
    );
    res.send(buffer);
  }

  /**
   * معاينة ملف Excel قبل التنفيذ — يُرجع الصفوف المُحلّلة + الأخطاء.
   * لا يكتب في DB.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post('import/preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async importPreview(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('لم يتم رفع ملف');
    }
    const rows = await this.bulkImport.parseExcel(file.buffer);
    const errors = rows.filter((r) => r.errors && r.errors.length > 0);
    return {
      rows,
      summary: {
        total: rows.length,
        valid: rows.length - errors.length,
        invalid: errors.length,
      },
    };
  }

  /**
   * تنفيذ الاستيراد — يُنشئ المستخدمين + الزبائن.
   * يُرجع قائمة المُنشأين مع كلمات السر للطباعة.
   *
   * skipInvalid يأتي كـ query لتفادي تعارض ValidationPipe مع multipart body.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post('import/commit')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async importCommit(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Query('skipInvalid') skipInvalidQuery?: string,
  ) {
    if (!file) {
      throw new Error('لم يتم رفع ملف');
    }
    const skipInvalid = skipInvalidQuery === 'true' || skipInvalidQuery === '1';
    const rows = await this.bulkImport.parseExcel(file.buffer);
    const hasErrors = rows.some((r) => r.errors && r.errors.length > 0);
    if (hasErrors && !skipInvalid) {
      return {
        ok: false,
        message: 'يوجد صفوف فيها أخطاء — استخدم skipInvalid=true لتجاهلها والاستيراد بالباقي',
        rows,
      };
    }
    return this.customers.bulkCreate(user.tenantId!, rows);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomerDto) {
    return this.customers.create(user.tenantId!, dto);
  }

  @RequireCapability('plant_admin', 'driver')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'district', required: false })
  @ApiQuery({ name: 'search', required: false })
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query('status') status?: CustomerStatus,
    @Query('district') district?: string,
    @Query('search') search?: string,
  ) {
    return this.customers.list(
      user.tenantId!,
      { status, district, search },
      pagination.page,
      pagination.pageSize,
    );
  }

  /**
   * GET /customers/me — يجلب ملف الزبون الحالي (المسجّل دخوله).
   * مطلوب: capability customer (الزبون نفسه)
   * يجب أن يأتي قبل /:id حتى لا يُطابق "me" كـ ID
   */
  @RequireCapability('customer')
  @Get('me')
  @UseInterceptors(UserScopedCacheInterceptor)
  @CacheTTL(30_000) // 30 s — short so a refilled balance shows up quickly
  findMe(@CurrentUser() user: AuthUser) {
    return this.customers.findByUserId(user.id);
  }

  /**
   * POST /customers/register-by-driver — مندوب يسجّل زبون جديد عند الباب.
   * يستهلكها mobile-worker. الحقول GPS إلزامية (لأن المندوب هناك فعلاً)،
   * و `onboardedByDriverId` يُسحب من الـ JWT.
   */
  @RequireCapability('driver')
  @Post('register-by-driver')
  async registerByDriver(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegisterByDriverDto,
  ) {
    return this.customers.registerByDriver(user.tenantId!, user.id, dto);
  }

  @RequireCapability('plant_admin', 'driver')
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.customers.findOne(user.tenantId!, id);
  }

  /**
   * Plant admin approves a customer that a driver registered in the field
   * (status: PENDING_APPROVAL → ACTIVE). On first approval, the
   * tenant.newCustomerBonusIqd amount is snapshotted onto the Customer row
   * so the driver's monthly salary picks it up. Returns the freshly-minted
   * temporary password — caller must hand it to the customer over WhatsApp
   * (we never store the plaintext).
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post(':id/approve')
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.customers.approve(user.tenantId!, id);
  }

  /** Plant admin or driver recalibrates an existing customer's home GPS. */
  @RequireCapability('plant_admin', 'driver')
  @Post(':id/location')
  captureLocation(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CaptureLocationDto,
  ) {
    return this.customers.captureLocation(user.tenantId!, id, dto.lng, dto.lat, dto.source);
  }

  /** Customer or plant flags a move to a new home. */
  @RequireCapability('plant_admin', 'customer')
  @Post(':id/move')
  move(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: MoveDto,
  ) {
    // A plant admin may relocate any customer in their tenant; a plain customer
    // may relocate ONLY their own record. Pass the requester's userId in the
    // customer case so the service scopes the lookup to { userId } — closing the
    // IDOR where any authenticated customer could move another customer's home
    // by guessing/iterating the :id path param.
    const ownerUserId = user.capabilities.includes('plant_admin') ? undefined : user.id;
    return this.customers.startMove(user.tenantId!, id, dto.newLng, dto.newLat, ownerUserId);
  }

  /**
   * Plant admin resets a customer's login password. The plain new value is
   * returned ONCE so the admin can hand it back. Useful when a customer
   * forgets — there is no SMS-based reset flow yet.
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post(':id/reset-password')
  resetPassword(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.customers.resetPassword(user.tenantId!, id, dto.password);
  }
}
