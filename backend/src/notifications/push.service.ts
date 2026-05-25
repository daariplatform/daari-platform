import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Sends push notifications via the Expo Push API (free, handles APNs +
 * FCM for us). We don't need a server-side Expo SDK — a simple fetch to
 * the public endpoint works and avoids the heavy `expo-server-sdk` dep.
 *
 * Token storage: each User can have N PushToken rows (one per device).
 * When sending, we look up all tokens for the user and dispatch in batch.
 *
 * Failure handling: Expo returns per-message status. If a token is
 * permanently invalid ("DeviceNotRegistered") we drop it from DB so we
 * don't keep retrying.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly endpoint = 'https://exp.host/--/api/v2/push/send';

  constructor(private prisma: PrismaService) {}

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

  private async sendToTokens(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, unknown>,
  ): Promise<{ sent: number; failed: number }> {
    // Expo accepts up to 100 messages per request — chunk to stay safe.
    const chunks: string[][] = [];
    for (let i = 0; i < tokens.length; i += 100) chunks.push(tokens.slice(i, i + 100));

    let sent = 0;
    let failed = 0;
    const invalidTokens: string[] = [];

    for (const chunk of chunks) {
      const messages = chunk.map((token) => ({
        to: token,
        sound: 'default',
        title,
        body,
        data,
        // Arabic-aware priority — orders should arrive without delay.
        priority: 'high' as const,
      }));
      try {
        const res = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messages),
        });
        if (!res.ok) {
          this.logger.warn(`Expo push HTTP ${res.status}`);
          failed += chunk.length;
          continue;
        }
        const payload = (await res.json()) as { data?: Array<{ status: string; details?: { error?: string } }> };
        payload.data?.forEach((r, idx) => {
          if (r.status === 'ok') sent++;
          else {
            failed++;
            // DeviceNotRegistered → the user uninstalled or revoked perms.
            // Drop the token from DB so future sends don't waste API calls.
            if (r.details?.error === 'DeviceNotRegistered') {
              invalidTokens.push(chunk[idx]);
            }
          }
        });
      } catch (err: any) {
        this.logger.error(`Expo push network error: ${err?.message ?? err}`);
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
