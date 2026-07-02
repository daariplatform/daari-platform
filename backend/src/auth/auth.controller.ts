import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  OtpLoginDto,
  RefreshDto,
  VerifyOtpDto,
} from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private config: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  // 20 attempts per 15 minutes per IP — Iraqi customers frequently forget
  // the temp passwords plant admins assign them, so 5 was too tight (broke
  // legitimate retry flows). 20 still stops automated credential stuffing
  // (a real brute-force needs thousands of attempts per minute).
  @Throttle({ default: { limit: 20, ttl: 15 * 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.phone, dto.password);
  }

  /**
   * OTP-based self-signup. Disabled at launch (customers are provisioned
   * by their plant from the dashboard). Enable later by setting
   * `OTP_SELF_SIGNUP_ENABLED=true` once a real SMS provider is wired up.
   */
  @Public()
  @Post('login/otp')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 15 * 60_000 } })
  otp(@Body() dto: OtpLoginDto) {
    if (this.config.get<string>('OTP_SELF_SIGNUP_ENABLED') !== 'true') {
      throw new ForbiddenException(
        'Self-signup is not enabled yet. Ask your water plant to create your account.',
      );
    }
    return this.auth.loginWithOtp(dto.phone, dto.otp, dto.fullName);
  }

  /**
   * Step 1 of self-service password reset. Sends a 6-digit OTP via otpiq
   * (WhatsApp → Telegram → SMS in that order). User must have logged in
   * at least once before — this prevents both fraud and OTP-cost burn on
   * accounts that were bulk-provisioned but never claimed.
   *
   * 3 codes per user per hour, hashed on storage, 10-minute TTL.
   */
  /**
   * Step 1 of new-customer self-signup. Sends a 6-digit OTP to a prospect's
   * phone via otpiq. They use it to prove ownership of the number before
   * we create a Customer lead in the chosen plant's queue.
   */
  @Public()
  @Post('signup/request-otp')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  requestSignupOtp(@Body() dto: ForgotPasswordDto) {
    return this.auth.requestSignupOtp(dto.phone);
  }

  /**
   * Step 2 — verify the signup OTP. After this, the mobile client gets a
   * 15-minute window to call POST /customers/lead. The lead endpoint
   * trusts this verification implicitly (so we don't burn OTP twice).
   */
  @Public()
  @Post('signup/verify-otp')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 15 * 60_000 } })
  verifySignupOtp(@Body() dto: { phone: string; otp: string }) {
    return this.auth.verifySignupOtp(dto.phone, dto.otp);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.requestPasswordReset(dto.phone);
  }

  /**
   * Step 2 of self-service password reset. Verifies the OTP, sets the new
   * password, revokes all existing refresh tokens (in case the account was
   * compromised), and returns fresh login tokens for immediate sign-in.
   */
  @Public()
  @Post('verify-otp')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 15 * 60_000 } })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtpAndResetPassword(dto.phone, dto.otp, dto.newPassword);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
  }

  /**
   * Returns the current user's identity + capabilities. Apps poll this to
   * refresh their capability-driven UI after a profile change.
   */
  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return {
      id: user.id,
      phone: user.phone,
      role: user.role,
      tenantId: user.tenantId,
      capabilities: user.capabilities,
    };
  }

  /**
   * Lets a logged-in user change their own password. Required after first
   * login since the plant's temporary password is known to the plant admin
   * — the customer should rotate it to something only they know.
   */
  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(200)
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  /**
   * Self-service account deletion (App Store Guideline 5.1.1 + Play Store
   * data-deletion requirement). Anonymises the user — name, phone, etc.
   * blanked — but keeps the row so completed-order foreign keys, revenue
   * totals, and the plant's audit trail stay intact. The user can't log
   * back in afterwards. Customer→Tank link is severed so the tank returns
   * to inventory.
   */
  @ApiBearerAuth()
  @Delete('me')
  @HttpCode(200)
  deleteMe(@CurrentUser() user: AuthUser) {
    return this.auth.deleteMyAccount(user.id);
  }
}
