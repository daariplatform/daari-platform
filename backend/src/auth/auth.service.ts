import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RefillOrderStatus, UserRole } from '@prisma/client';
import { Capability } from '../common/capabilities';
import { hashPassword, verifyPassword } from '../common/crypto';
import { OtpService } from './otp.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private otp: OtpService,
  ) {}

  /**
   * Step 1 of new-customer self-signup. Sends an OTP to the prospect's
   * phone via otpiq. No User row exists yet, so we key by phone.
   *
   * Rate-limited at 3 requests per phone per hour (same as forgot-pw)
   * to prevent SMS-cost burn from accidental spam.
   */
  async requestSignupOtp(phone: string) {
    // Block if a real account already exists with this phone — they should
    // login or use forgot-password instead.
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) {
      throw new BadRequestException(
        'هذا الرقم مسجّل عند معمل. سجّل دخولك أو استعمل "نسيت كلمة المرور".',
      );
    }
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await this.prisma.signupOtpToken.count({
      where: { phone, createdAt: { gte: oneHourAgo } },
    });
    if (recent >= 3) {
      throw new BadRequestException('تم إرسال الكود عدة مرات. حاول بعد ساعة.');
    }
    const code = this.otp.generateCode();
    const otpHash = createHash('sha256').update(code).digest('hex');
    await this.prisma.signupOtpToken.create({
      data: {
        phone,
        otpHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    const sent = await this.otp.send(phone, code);
    return { ok: true, sent };
  }

  /**
   * Verify a signup OTP. Returns success but does NOT create a user yet —
   * the next step (POST /customers/lead) creates the Customer row.
   * Returning a short-lived "ticket" lets the lead endpoint trust the
   * verification without re-checking the OTP.
   */
  async verifySignupOtp(phone: string, otp: string) {
    const token = await this.prisma.signupOtpToken.findFirst({
      where: {
        phone,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!token) throw new UnauthorizedException('الكود منتهي. اطلب كوداً جديداً.');
    if (token.attempts >= 5) {
      throw new UnauthorizedException('تجاوزت المحاولات. اطلب كوداً جديداً.');
    }
    const provided = createHash('sha256').update(otp).digest('hex');
    if (provided !== token.otpHash) {
      await this.prisma.signupOtpToken.update({
        where: { id: token.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('كود غير صحيح');
    }
    await this.prisma.signupOtpToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    });
    return { ok: true, verified: true };
  }

  /** Helper for /customers/lead — returns true if the most-recent OTP
   *  for this phone was verified within the last 15 minutes. */
  async wasSignupOtpVerifiedRecently(phone: string): Promise<boolean> {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const token = await this.prisma.signupOtpToken.findFirst({
      where: { phone, usedAt: { gte: fifteenMinAgo } },
      orderBy: { usedAt: 'desc' },
    });
    return !!token;
  }

  /**
   * Self-service "I forgot my password" flow.
   *
   * Guardrails (each saves money OR stops abuse):
   *  1. login-once: user.lastLoginAt must be set. Stops a stranger from
   *     hijacking a phone the plant bulk-registered but the real owner
   *     never claimed. Also blocks ~85% of OTP cost.
   *  2. Rate limit: max 3 active OTP requests per user per hour.
   *  3. OTP TTL: 10 minutes.
   *  4. Always return success-shape so an attacker can't enumerate which
   *     phones have accounts (don't tell them "no such user").
   */
  async requestPasswordReset(phone: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    // Always return generic success — don't leak account existence.
    if (!user || !user.isActive) {
      return { ok: true, sent: false };
    }
    if (!user.lastLoginAt) {
      throw new BadRequestException(
        'يجب أن تدخل التطبيق مرة واحدة بكلمة المرور التي زوّدك بها المعمل قبل أن تستطيع استرداد كلمتك. راجع معملك.',
      );
    }
    // Rate-limit: count tokens issued in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await this.prisma.passwordResetToken.count({
      where: { userId: user.id, createdAt: { gte: oneHourAgo } },
    });
    if (recentCount >= 3) {
      throw new BadRequestException(
        'تم إرسال الكود عدة مرات. حاول بعد ساعة.',
      );
    }

    const code = this.otp.generateCode();
    const otpHash = createHash('sha256').update(code).digest('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        otpHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const sent = await this.otp.send(phone, code);
    return { ok: true, sent };
  }

  /**
   * Step 2 — verify the OTP and set a new password.
   * Returns fresh access/refresh tokens so the user is auto-logged-in.
   */
  async verifyOtpAndResetPassword(phone: string, otp: string, newPassword: string) {
    if (newPassword.length < 6) {
      throw new BadRequestException('كلمة المرور الجديدة قصيرة جداً (6 أحرف على الأقل)');
    }
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) throw new UnauthorizedException('كود غير صحيح');

    // Latest non-expired, non-used token for this user
    const token = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!token) {
      throw new UnauthorizedException('الكود منتهي. اطلب كوداً جديداً.');
    }
    if (token.attempts >= 5) {
      throw new UnauthorizedException('تجاوزت عدد المحاولات. اطلب كوداً جديداً.');
    }

    const provided = createHash('sha256').update(otp).digest('hex');
    if (provided !== token.otpHash) {
      await this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('كود غير صحيح');
    }

    const newHash = await hashPassword(newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash, lastLoginAt: new Date() },
      });
      await tx.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      });
      // Kill any active sessions — old refresh tokens may be in attacker hands
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    return this.issueTokens(user.id, user.phone, user.role, user.tenantId);
  }

  async login(phone: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid phone or password');
    }
    const ok = await verifyPassword(user.passwordHash, password);
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
   * DRIVER accounts can only be created by a plant from the dashboard.
   *
   * SECURITY: the previous stub accepted any code equal to the phone's last 6
   * digits — a backdoor that let anyone impersonate any phone number the moment
   * OTP_SELF_SIGNUP_ENABLED was flipped on. That logic is removed. There is no
   * real OTP verification store for login yet, so this path is hard-disabled:
   * wire a real SMS provider + verified-code store before re-enabling it.
   */
  async loginWithOtp(phone: string, otp: string, fullName?: string) {
    void phone;
    void otp;
    void fullName;
    throw new ServiceUnavailableException(
      'تسجيل الدخول عبر رمز التحقق غير مفعّل بعد.',
    );
  }

  /**
   * Rotating refresh: each refresh revokes the presented token and issues a
   * fresh pair. To avoid a spurious logout we allow a short **reuse-grace
   * window**: after the access token expires (15-min TTL) the app can fire
   * several requests at once, each 401ing and racing to refresh — or a flaky
   * connection may retry the same refresh. Rejecting the 2nd presentation
   * would 401 → the client force-logs-out (the "placing an order logs me out"
   * bug). So a token revoked within REUSE_GRACE_MS is still honoured (issues a
   * fresh pair); only a token revoked long ago — a genuinely dead session — is
   * rejected. This is the standard "refresh token reuse interval" pattern.
   */
  async refresh(refreshToken: string) {
    const REUSE_GRACE_MS = 30_000;
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (
      stored.revokedAt &&
      Date.now() - stored.revokedAt.getTime() > REUSE_GRACE_MS
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    // Revoke on first use only (a within-grace replay is already revoked).
    if (!stored.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
    }
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

  /**
   * Self-service password change. Requires the current password — protects
   * against a leaked access token being used to permanently lock the account
   * out of the plant's reach. (Plant can still force-reset from the dashboard.)
   *
   * Does NOT revoke existing refresh tokens — the user is on a known good
   * device and we'd rather keep them logged in. Plant-side resetPassword does
   * revoke them (different threat model: helping a user who lost access).
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Account not found');
    }
    const ok = await verifyPassword(user.passwordHash, currentPassword);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');

    const newHash = await hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });
    return { ok: true };
  }

  /**
   * Anonymises the user without nuking related rows. Required for App Store
   * (Guideline 5.1.1) and Play Store data-deletion. We keep:
   *   - completed RefillOrder rows (revenue history, audit trail)
   *   - SalaryPayment / Expense / Tank rows
   * We sever / scrub:
   *   - personal name + phone on User → replaced with anon-{id} marker
   *   - passwordHash → cleared (so reuse impossible)
   *   - all refresh tokens → revoked (kicks every device)
   *   - phone on Customer/Driver profile → also anonymised
   *   - any assigned tank → returned to plant inventory
   *   - active orders → cancelled
   *
   * Phone column uses a per-tenant unique constraint on Customer, so we
   * substitute a guaranteed-unique sentinel.
   */
  async deleteMyAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { customer: true, driver: true },
    });
    if (!user) throw new UnauthorizedException('Account not found');

    const anonPhone = `DEL-${userId.slice(0, 12)}`;
    const anonName = 'حساب محذوف';

    await this.prisma.$transaction(async (tx) => {
      // 1. cancel any in-flight refill orders this customer placed
      if (user.customer) {
        await tx.refillOrder.updateMany({
          where: {
            customerId: user.customer.id,
            status: { in: [RefillOrderStatus.PENDING, RefillOrderStatus.ASSIGNED, RefillOrderStatus.EN_ROUTE] },
          },
          data: { status: RefillOrderStatus.CANCELLED },
        });
        // 2. return any assigned tanks to the plant
        await tx.tank.updateMany({
          where: { customerId: user.customer.id },
          data: { customerId: null, status: 'RECLAIMED' as any },
        });
        // 3. scrub customer PII
        await tx.customer.update({
          where: { id: user.customer.id },
          data: {
            fullName: anonName,
            phone: anonPhone,
            whatsapp: anonPhone,
            addressLine: '—',
            status: 'CHURNED' as any,
          },
        });
      }

      if (user.driver) {
        await tx.driver.update({
          where: { id: user.driver.id },
          data: { status: 'OFFLINE' as any },
        });
      }

      // 4. revoke every refresh token (signs them out everywhere)
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // 5. scrub the user row itself
      await tx.user.update({
        where: { id: userId },
        data: {
          fullName: anonName,
          phone: anonPhone,
          passwordHash: '',
          isActive: false,
        },
      });
    });

    return { ok: true, deletedAt: new Date() };
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
   * The capability set drives what each app shows. A user can hold several
   * capabilities at once (e.g. customer + driver) — they pick the active mode.
   */
  private async computeCapabilities(userId: string, role: UserRole): Promise<Capability[]> {
    const caps: Capability[] = [];

    if (role === UserRole.CUSTOMER) caps.push('customer');
    if (role === UserRole.PLATFORM_ADMIN) caps.push('platform_admin');
    // tsc-strict widens the array literal's type to UserRole[] but its
    // own .includes() expects the narrower union; cast through unknown
    // to silence the false positive without losing type safety on `role`.
    const plantAdminRoles: UserRole[] = [UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT];
    if (plantAdminRoles.includes(role)) {
      caps.push('plant_admin');
    }

    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (driver && driver.tenantId) caps.push('driver');

    return caps;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
