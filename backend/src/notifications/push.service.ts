import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Sends push notifications via Firebase Cloud Messaging (FCM) using the
 * firebase-admin SDK. The mobile apps (Flutter) register raw FCM device
 * tokens via POST /notifications/register-token; we store one PushToken
 * row per device and fan a message out to all of a user's tokens.
 *
 * Credentials: a Firebase service account is read once at first use from
 *   FIREBASE_SERVICE_ACCOUNT_JSON                  (inline JSON), or
 *   FIREBASE_SERVICE_ACCOUNT_PATH / GOOGLE_APPLICATION_CREDENTIALS (file path).
 * If none is configured the service degrades gracefully to a no-op (so dev
 * environments run without Firebase). Every send is best-effort — callers
 * MUST NOT block on the result.
 *
 * Failure handling: FCM returns a per-token result. A permanently invalid
 * token ("messaging/registration-token-not-registered") is pruned from the
 * DB so future sends don't keep wasting calls.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private messaging: admin.messaging.Messaging | null = null;
  private initTried = false;

  constructor(private prisma: PrismaService) {}

  /**
   * Lazily resolve an FCM messaging client from a service-account credential.
   * Returns null (warned once) when Firebase isn't configured.
   */
  private getMessaging(): admin.messaging.Messaging | null {
    if (this.messaging) return this.messaging;
    if (this.initTried) return null;
    this.initTried = true;

    try {
      const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      const path =
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH ??
        process.env.GOOGLE_APPLICATION_CREDENTIALS;

      let credential: admin.credential.Credential | null = null;
      if (inline) credential = admin.credential.cert(JSON.parse(inline));
      else if (path) credential = admin.credential.cert(path);

      if (!credential) {
        this.logger.warn(
          'Firebase not configured (FIREBASE_SERVICE_ACCOUNT_JSON / _PATH) — push disabled',
        );
        return null;
      }

      const app = admin.apps.length ? admin.app() : admin.initializeApp({ credential });
      this.messaging = app.messaging();
      return this.messaging;
    } catch (err: any) {
      this.logger.error(`Firebase init failed: ${err?.message ?? err}`);
      return null;
    }
  }

  /** Register / upsert a push token for a user. Called from mobile after login. */
  async registerToken(userId: string, token: string, platform: 'ios' | 'android') {
    await this.prisma.pushToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform, lastSeenAt: new Date() },
    });
    return { ok: true };
  }

  /**
   * Send a push to a specific user across all their devices. `data` is
   * an arbitrary payload — the mobile app reads it on tap to navigate
   * (e.g. {orderId: 'abc'} → open order detail screen).
   */
  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data: Record<string, unknown> = {},
  ) {
    const tokens = await this.prisma.pushToken.findMany({
      where: { userId },
      select: { token: true },
    });
    if (tokens.length === 0) return { sent: 0, failed: 0 };
    return this.sendToTokens(
      tokens.map((t) => t.token),
      title,
      body,
      data,
    );
  }

  /** Bulk send — used by promo blasts (Wave 5). */
  async sendToUsers(
    userIds: string[],
    title: string,
    body: string,
    data: Record<string, unknown> = {},
  ) {
    const tokens = await this.prisma.pushToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true },
    });
    if (tokens.length === 0) return { sent: 0, failed: 0 };
    return this.sendToTokens(
      tokens.map((t) => t.token),
      title,
      body,
      data,
    );
  }

  /**
   * Send a push to every admin-class user of a tenant (OWNER, MANAGER,
   * ACCOUNTANT). Used for plant-facing alerts: new customer lead arrived,
   * new order placed, stock dipped below threshold. The mobile-admin app
   * uses the `kind` field in `data` to route the tap to the right tab.
   *
   * Best-effort: returns 0/0 without throwing if the tenant has no admins
   * with a registered device. Callers MUST NOT block on the result.
   */
  async sendToTenantAdmins(
    tenantId: string,
    title: string,
    body: string,
    data: Record<string, unknown> = {},
  ) {
    const admins = await this.prisma.user.findMany({
      where: {
        tenantId,
        role: { in: ['OWNER', 'MANAGER', 'ACCOUNTANT'] },
      },
      select: { id: true },
    });
    if (admins.length === 0) return { sent: 0, failed: 0 };
    return this.sendToUsers(
      admins.map((u) => u.id),
      title,
      body,
      data,
    );
  }

  private async sendToTokens(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, unknown>,
  ): Promise<{ sent: number; failed: number }> {
    const messaging = this.getMessaging();
    if (!messaging) return { sent: 0, failed: tokens.length };

    // FCM data payloads must be string→string. Coerce every value so the
    // mobile app can still read e.g. data.orderId / data.kind on tap.
    const stringData: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      stringData[k] = typeof v === 'string' ? v : JSON.stringify(v);
    }

    // sendEachForMulticast accepts up to 500 tokens per call — chunk to stay safe.
    const chunks: string[][] = [];
    for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500));

    let sent = 0;
    let failed = 0;
    const invalidTokens: string[] = [];

    for (const chunk of chunks) {
      try {
        const res = await messaging.sendEachForMulticast({
          tokens: chunk,
          notification: { title, body },
          data: stringData,
          // Orders should arrive without delay on both platforms.
          android: { priority: 'high' },
          apns: { headers: { 'apns-priority': '10' } },
        });
        sent += res.successCount;
        failed += res.failureCount;
        res.responses.forEach((r, idx) => {
          const code = r.error?.code;
          // Token no longer valid (app uninstalled / token rotated) → prune
          // so future sends don't keep wasting calls. Other errors (transient
          // / payload) are left alone — we don't drop a possibly-good token.
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            invalidTokens.push(chunk[idx]);
          }
        });
      } catch (err: any) {
        this.logger.error(`FCM send error: ${err?.message ?? err}`);
        failed += chunk.length;
      }
    }

    if (invalidTokens.length > 0) {
      await this.prisma.pushToken.deleteMany({ where: { token: { in: invalidTokens } } });
      this.logger.log(`Pruned ${invalidTokens.length} dead push tokens`);
    }

    return { sent, failed };
  }
}
