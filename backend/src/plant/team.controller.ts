import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { randomBytes } from 'crypto';
import { UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { hashPassword } from '../common/crypto';

class InviteTeamMemberDto {
  @Matches(/^07\d{9}$/) phone!: string;
  @IsString() @MinLength(2) fullName!: string;
  /** Only MANAGER + ACCOUNTANT can be invited — OWNER is the founder seat. */
  @IsIn([UserRole.MANAGER, UserRole.ACCOUNTANT]) role!: UserRole;
}

class UpdateTeamMemberDto {
  @IsOptional()
  @IsIn([UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.OWNER])
  role?: UserRole;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

// Same alphabet/length as drivers + customers.
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
function generatePassword(): string {
  const bytes = randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
  }
  return out;
}

/**
 * TeamController — plant-side team management.
 *
 * Lists, invites, updates, and soft-deletes plant-side staff (OWNER /
 * MANAGER / ACCOUNTANT). Drivers + customers are managed by their own
 * modules. The founding OWNER (`user.phone === tenant.ownerPhone`) can
 * never be deleted nor demoted by another team member — this is the
 * "seat of last resort" so the plant always has at least one admin.
 *
 * Read endpoints: OWNER + MANAGER.
 * Write endpoints: OWNER only.
 */
@ApiBearerAuth()
@ApiTags('plant-team')
@UseGuards(RolesGuard)
@Controller('plant/team')
export class TeamController {
  constructor(private prisma: PrismaService) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const tenantId = user.tenantId!;
    const [members, tenant] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          tenantId,
          role: { in: [UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT] },
        },
        select: {
          id: true,
          phone: true,
          fullName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { ownerPhone: true },
      }),
    ]);

    return members.map((m) => ({
      ...m,
      // Flag the founding seat so the UI can hide the delete button on it.
      isFoundingOwner: m.phone === tenant?.ownerPhone,
    }));
  }

  @Roles(UserRole.OWNER)
  @Post()
  async invite(@CurrentUser() user: AuthUser, @Body() dto: InviteTeamMemberDto) {
    const tenantId = user.tenantId!;

    const existing = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (existing) {
      throw new ConflictException('يوجد مستخدم بهذا الرقم بالفعل');
    }

    const plainPassword = generatePassword();
    const passwordHash = await hashPassword(plainPassword);

    const created = await this.prisma.user.create({
      data: {
        tenantId,
        phone: dto.phone,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
      },
      select: {
        id: true,
        phone: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await this.audit(user, 'team.invite', 'User', created.id, null, created);

    // tempPassword returned ONCE so the inviting OWNER can hand it over
    // (WhatsApp / verbally). Not stored anywhere else.
    return { ...created, tempPassword: plainPassword };
  }

  @Roles(UserRole.OWNER)
  @Patch(':userId')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
    @Body() dto: UpdateTeamMemberDto,
  ) {
    const tenantId = user.tenantId!;

    const target = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!target) throw new NotFoundException('عضو الفريق غير موجود');

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { ownerPhone: true },
    });
    const isFoundingOwner = target.phone === tenant?.ownerPhone;

    // Guardrails: never strip the founding OWNER of role or isActive.
    if (isFoundingOwner) {
      if (dto.role && dto.role !== UserRole.OWNER) {
        throw new ForbiddenException('لا يمكن تغيير دور المالك الأصلي');
      }
      if (dto.isActive === false) {
        throw new ForbiddenException('لا يمكن تعطيل حساب المالك الأصلي');
      }
    }

    // Don't let an OWNER role be assigned via this endpoint (only the
    // founding seat is OWNER; promoting another user creates ambiguity
    // about who's "the" owner).
    if (dto.role === UserRole.OWNER && !isFoundingOwner) {
      throw new BadRequestException(
        'لا يمكن منح دور المالك — استخدم MANAGER أو ACCOUNTANT',
      );
    }

    const data: Record<string, unknown> = {};
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('لا توجد تغييرات للحفظ');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        phone: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });

    // If we deactivated, revoke refresh tokens to force sign-out.
    if (dto.isActive === false) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.audit(user, 'team.update', 'User', userId, target, updated);
    return updated;
  }

  @Roles(UserRole.OWNER)
  @Delete(':userId')
  async softDelete(@CurrentUser() user: AuthUser, @Param('userId') userId: string) {
    const tenantId = user.tenantId!;

    const target = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!target) throw new NotFoundException('عضو الفريق غير موجود');

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { ownerPhone: true },
    });
    if (target.phone === tenant?.ownerPhone) {
      throw new ForbiddenException('لا يمكن حذف المالك الأصلي للمعمل');
    }

    // Don't let an OWNER delete themselves.
    if (target.id === user.id) {
      throw new ForbiddenException('لا يمكنك حذف حسابك');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit(user, 'team.delete', 'User', userId, target, null);
    return { ok: true };
  }

  private async audit(
    user: AuthUser,
    action: string,
    entityType: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: user.tenantId,
          actorId: user.id,
          actorName: user.phone,
          action,
          entityType,
          entityId,
          before: before as any,
          after: after as any,
        },
      });
    } catch (e: any) {
      console.warn('[audit] team log failed:', e?.message);
    }
  }
}
