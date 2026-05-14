import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class SmsProvider {
  private readonly log = new Logger(SmsProvider.name);

  constructor(private config: ConfigService) {}

  /**
   * Generic SMS gateway adapter. Replace the body shape per provider
   * (Zain Iraq / Asiacell / Korek). Returns provider message id or null.
   */
  async send(toPhone: string, body: string): Promise<string | null> {
    const url = this.config.get<string>('SMS_PROVIDER_URL');
    const key = this.config.get<string>('SMS_PROVIDER_KEY');
    const sender = this.config.get<string>('SMS_SENDER', 'MAA');

    if (!url || !key) {
      this.log.warn(`SMS not configured — would send to ${toPhone}: ${body}`);
      return null;
    }

    try {
      const res = await axios.post(
        url,
        { to: toPhone, sender, body },
        { headers: { 'X-API-Key': key }, timeout: 8000 },
      );
      return res.data?.id ?? null;
    } catch (err) {
      this.log.error(`SMS send failed for ${toPhone}: ${(err as Error).message}`);
      throw err;
    }
  }
}
