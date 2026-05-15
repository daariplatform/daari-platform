import { Body, Controller, Get, HttpCode, Post, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, OtpLoginDto, RefreshDto } from './dto/login.dto';
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
  // 5 attempts per 15 minutes per IP — defeats credential-stuffing while
  // still being generous enough that a customer fat-fingering their own
  // password a couple of times can keep trying.
  @Throttle({ auth: { limit: 5, ttl: 15 * 60_000 } })
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
  @Throttle({ auth: { limit: 5, ttl: 15 * 60_000 } })
  otp(@Body() dto: OtpLoginDto) {
    if (this.config.get<string>('OTP_SELF_SIGNUP_ENABLED') !== 'true') {
      throw new ForbiddenException(
        'Self-signup is not enabled yet. Ask your water plant to create your account.',
      );
    }
    return this.auth.loginWithOtp(dto.phone, dto.otp, dto.fullName);
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
   * Returns the current user's identity + capabilities. The worker app
   * polls this after vendor self-registration to refresh its mode toggle.
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
}
