import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'node:crypto';

/**
 * Thin wrapper over the otpiq.com SMS API.
 *
 * `provider: "whatsapp-telegram-sms"` lets otpiq attempt delivery via
 * WhatsApp first (usually free at otpiq), fall back to Telegram, then
 * SMS as the last resort. Net cost in Iraq averages well under the
 * 80 IQD list price because most users have WhatsApp installed.
 *
 * In dev (no OTPIQ_API_KEY set), we just log the OTP instead of sending —
 * keeps integration tests deterministic and free.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly apiKey: string | undefined;
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('OTPIQ_API_KEY');
    this.enabled = !!this.apiKey;
    if (!this.enabled) {
      this.logger.warn(
        'OTPIQ_API_KEY not set — OTP sends will be logged to console only (dev mode)',
      );
    }
  }

  /** Generate a 6-digit numeric OTP using a CSPRNG (not Math.random). */
  generateCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  /**
   * Send the OTP to a phone number. Iraqi numbers normalised to
   * E.164 (e.g. 07712345678 → 9647712345678).
   * Returns true on success; the caller logs / handles the false case.
   */
  async send(phone: string, code: string): Promise<boolean> {
    const normalised = this.toE164Iraq(phone);
    if (!this.enabled) {
      // Dev fallback — print the code so the developer / QA can complete
      // the flow without spending money. Never reaches production because
      // OTPIQ_API_KEY will be set in /var/www/daari-water-api/.env.
      this.logger.warn(
        `[OTP DEV] Would send code ${code} to ${normalised}. ` +
          'Set OTPIQ_API_KEY env to enable real delivery.',
      );
      return true;
    }

    try {
      const res = await fetch('https://api.otpiq.com/api/sms', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: normalised,
          smsType: 'verification',
          // Try cheap channels first; SMS only as last resort.
          provider: 'whatsapp-telegram-sms',
          verificationCode: code,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '<no body>');
        this.logger.error(
          `otpiq error ${res.status} sending to ${normalised}: ${body.slice(0, 200)}`,
        );
        return false;
      }
      return true;
    } catch (err: any) {
      this.logger.error(`otpiq network failure: ${err?.message ?? err}`);
      return false;
    }
  }

  /** Convert Iraqi local format (07XXXXXXXXX) to E.164 (9647XXXXXXXXX). */
  private toE164Iraq(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('964')) return digits;
    if (digits.startsWith('0')) return `964${digits.slice(1)}`;
    if (digits.startsWith('7')) return `964${digits}`;
    throw new BadRequestException(`Invalid Iraqi phone format: ${phone}`);
  }
}
