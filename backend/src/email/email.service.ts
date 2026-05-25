import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

export interface ReceiptData {
  customerName: string;
  orderId: string;
  refillLiters: number;
  refillPriceIqd: number;
  tenantName: string;
  completedAt: Date;
}

@Injectable()
export class EmailService {
  private readonly log = new Logger(EmailService.name);

  constructor(private readonly mailer: MailerService) {}

  /**
   * Send a refill receipt to the customer. Never throws — email is
   * best-effort, never blocks order completion. Returns true if sent,
   * false on any failure (logged at warn).
   */
  async sendReceipt(to: string, data: ReceiptData): Promise<boolean> {
    if (!process.env.ZOHO_SMTP_PASS) {
      this.log.debug(`Email disabled (no SMTP creds) — would have sent receipt to ${to}`);
      return false;
    }
    try {
      await this.mailer.sendMail({
        to,
        subject: `إيصال تعبئة من معمل ${data.tenantName}`,
        template: 'receipt',
        context: {
          ...data,
          completedAtArabic: data.completedAt.toLocaleString('ar-IQ', {
            dateStyle: 'medium',
            timeStyle: 'short',
          }),
          priceFormatted: data.refillPriceIqd.toLocaleString('ar-IQ'),
        },
      });
      return true;
    } catch (err) {
      this.log.warn(`Email send failed (to=${to}): ${(err as Error).message}`);
      return false;
    }
  }
}
