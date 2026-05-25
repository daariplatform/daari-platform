import { Module, Global, Logger } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
// Newer @nestjs-modules/mailer (≥2.x) exposes adapters via the `./adapters/*`
// exports map. The legacy `/dist/adapters/...` path errors at runtime with
// ERR_PACKAGE_PATH_NOT_EXPORTED on Node 20+ because exports field is strict.
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { join } from 'path';
import { EmailService } from './email.service';

/**
 * Email delivery via Zoho SMTP (info@phi-bit.com mailbox).
 *
 * Templates live under `backend/src/email/templates/*.hbs` and are compiled
 * by handlebars at boot. Set ZOHO_SMTP_PASS in the systemd unit's
 * Environment= line — without it, EmailService.sendReceipt() will log a
 * warning and silently no-op (callers MUST never let email failures break
 * their main flow).
 */
@Global()
@Module({
  imports: [
    MailerModule.forRootAsync({
      useFactory: () => {
        const user = process.env.ZOHO_SMTP_USER ?? 'info@phi-bit.com';
        const pass = process.env.ZOHO_SMTP_PASS ?? '';
        const log = new Logger('MailerModule');

        if (!pass) {
          log.warn(
            'ZOHO_SMTP_PASS not set — outbound email is disabled. Set it in the systemd unit to enable receipts.',
          );
        }

        return {
          transport: {
            host: process.env.ZOHO_SMTP_HOST ?? 'smtppro.zoho.com',
            port: Number(process.env.ZOHO_SMTP_PORT ?? 465),
            secure: true,
            auth: pass ? { user, pass } : undefined,
          },
          defaults: {
            from: `"داري" <${user}>`,
          },
          template: {
            dir: join(__dirname, 'templates'),
            adapter: new HandlebarsAdapter(),
            options: { strict: false },
          },
        };
      },
    }),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
