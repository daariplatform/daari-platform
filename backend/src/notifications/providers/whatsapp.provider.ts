import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class WhatsAppProvider {
  private readonly log = new Logger(WhatsAppProvider.name);

  constructor(private config: ConfigService) {}

  /**
   * Sends a WhatsApp text message via the Meta Cloud API.
   * Returns the upstream message id, or null if not configured / failed.
   */
  async send(toPhone: string, body: string): Promise<string | null> {
    const token = this.config.get<string>('WHATSAPP_TOKEN');
    const phoneId = this.config.get<string>('WHATSAPP_PHONE_ID');

    if (!token || !phoneId) {
      this.log.warn(`WhatsApp not configured — would send to ${toPhone}: ${body}`);
      return null;
    }

    try {
      const res = await axios.post(
        `https://graph.facebook.com/v20.0/${phoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: toPhone.replace(/^0/, '964'),
          type: 'text',
          text: { body },
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 8000,
        },
      );
      return res.data?.messages?.[0]?.id ?? null;
    } catch (err) {
      this.log.error(`WhatsApp send failed for ${toPhone}: ${(err as Error).message}`);
      throw err;
    }
  }
}
