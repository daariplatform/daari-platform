import { Module, Global, Logger } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';
import { Keyv } from 'keyv';

import { UserScopedCacheInterceptor } from './user-scoped-cache.interceptor';

/**
 * App-wide cache layer.
 *
 * Backed by Redis when `REDIS_HOST` is set to a real host (default: 127.0.0.1).
 * Falls back to an in-memory store when `REDIS_HOST=disabled` so devs without
 * a running Redis can still boot the API. Default TTL is 60 s (overridable
 * per route with @CacheTTL).
 *
 * Note on packaging: the brief asked for `cache-manager-ioredis-yet`, but that
 * package is deprecated and incompatible with cache-manager v7 (which Nest 11's
 * @nestjs/cache-manager@3 depends on — v7 switched to a Keyv-based store API).
 * The maintainer's recommended replacement is `@keyv/redis`, which is what we
 * use here. Behaviour is identical: a single Redis connection, TTL in ms.
 */
@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true,
      // Return any to bridge the two shape variants (with vs without `stores`).
      // cache-manager v7's CacheOptions generic narrows StoreConfig per call,
      // and Nest's wrapper insists both branches return the same shape — they
      // don't, by design (in-memory fallback has no stores). Cast is safe:
      // both shapes are valid runtime inputs.
      useFactory: (): any => {
        const host = process.env.REDIS_HOST ?? '127.0.0.1';
        const port = Number(process.env.REDIS_PORT ?? 6379);
        const log = new Logger('CacheModule');

        const ttl = 60_000;

        if (host === 'disabled') {
          log.warn('REDIS_HOST=disabled — using in-memory cache (dev mode)');
          return { ttl };
        }

        log.log(`Cache backed by Redis at ${host}:${port}`);
        const keyvRedis = new KeyvRedis(`redis://${host}:${port}`);
        keyvRedis.on('error', (err) => log.warn(`Redis cache error: ${(err as Error).message}`));
        const store = new Keyv({ store: keyvRedis });
        store.on('error', (err) => log.warn(`Keyv cache error: ${(err as Error).message}`));

        return { stores: [store], ttl };
      },
    }),
  ],
  providers: [UserScopedCacheInterceptor],
  exports: [NestCacheModule, UserScopedCacheInterceptor],
})
export class CacheModule {}
