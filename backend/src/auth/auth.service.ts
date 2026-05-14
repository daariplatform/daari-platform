import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, VendorStatus } from '@prisma/client';
import { Capability } from '../common/capabilities';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(phone: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid phone or password');
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Invalid phone or password');
    if (!user.isActive) throw new UnauthorizedException('Account disabled');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokens(user.id, user.phone, user.role, user.tenantId);
  }

  /**
   * Self-service signup/login via OTP. Restricted to CUSTOMER only —
   * VENDOR capability is added after login through /vendors/me/register,
   * and DRIVER accounts can only be created by a plant from the dashboard.
   *
   * Stub: accepts any 6-digit code matching the phone's last 6 digits.
   * Wire to a real SMS provider before launch.
   */
  async loginWithOtp(phone: string, otp: string, fullName?: string) {
    const expected = phone.slice(-6);
    if (otp !== expected) throw new UnauthorizedException('Invalid OTP');

    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      if (!fullName) throw new BadRequestException('fullName required for first login');
      user = await this.prisma.user.create({
        data: { phone, fullName, role: UserRole.CUSTOMER },
      });
    }

    return this.issueTokens(user.id, user.phone, user.role, user.tenantId);
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(
      stored.user.id,
      stored.user.phone,
      stored.user.role,
      stored.user.tenantId,
    );
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(userId: string, phone: string, role: UserRole, tenantId: string | null) {
    const capabilities = await this.computeCapabilities(userId, role);

    const accessToken = await this.jwt.signAsync({
      sub: userId,
      phone,
      role,
      tenantId,
      capabilities,
    });

    const rawRefresh = randomBytes(48).toString('hex');
    const tokenHash = this.hashToken(rawRefresh);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      expiresIn: 900,
      capabilities,
    };
  }

  /**
   * The capability set drives what the worker app shows. A user can have
   * both 'driver' (works for a plant) and 'vendor' (works independently)
   * at the same time — they pick the active mode in the UI.
   */
  private async computeCapabilities(userId: string, role: UserRole): Promise<Capability[]> {
    const caps: Capability[] = [];

    if (role === UserRole.CUSTOMER) caps.push('customer');
    if (role === UserRole.PLATFORM_ADMIN) caps.push('platform_admin');
    if ([UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT].includes(role)) {
      caps.push('plant_admin');
    }

    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (driver && driver.tenantId) caps.push('driver');

    const vendor = await this.prisma.vendor.findUnique({ where: { userId } });
    if (vendor && vendor.status === VendorStatus.ACTIVE) caps.push('vendor');

    return caps;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
