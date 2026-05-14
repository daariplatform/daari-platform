import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, OtpLoginDto, RefreshDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.phone, dto.password);
  }

  @Public()
  @Post('login/otp')
  @HttpCode(200)
  otp(@Body() dto: OtpLoginDto) {
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
}
