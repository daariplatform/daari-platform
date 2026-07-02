import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { WHATSAPP_BLAST_QUEUE } from './queue.constants';
import { WhatsappBlastProcessor } from './whatsapp-blast.processor';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * BullMQ wiring. Uses the same Redis instance as CacheModule (REDIS_HOST,
 * REDIS_PORT env). When REDIS_HOST=disabled, BullMQ still expects a Redis
 * connection — we just point it at localhost:6379 anyway and let it fail
 * loudly so dev environments without Redis don't silently lose blasts.
 *
 * If you really want to skip queues in dev, set `BULLMQ_DISABLED=true` and
 * the producer side will short-circuit (TODO if needed).
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: process.env.REDIS_HOST === 'disabled' ? '127.0.0.1' : (process.env.REDIS_HOST ?? '127.0.0.1'),
          port: Number(process.env.REDIS_PORT ?? 6379),
          // Authenticate when Redis is password-protected (requirepass).
          ...(process.env.REDIS_PASSWORD
            ? { password: process.env.REDIS_PASSWORD }
            : {}),
        },
      }),
    }),
    BullModule.registerQueue({ name: WHATSAPP_BLAST_QUEUE }),
    // Processor needs WhatsAppProvider for outbound sends.
    NotificationsModule,
  ],
  providers: [WhatsappBlastProcessor],
  exports: [BullModule],
})
export class QueueModule {}
