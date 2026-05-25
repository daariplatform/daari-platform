import { ExecutionContext, Injectable } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import type { Request } from 'express';

/**
 * CacheInterceptor variant that scopes the cache key to the authenticated user
 * (and tenant where applicable). The stock @nestjs/cache-manager interceptor
 * keys solely on URL, which would leak one user's /customers/me payload to
 * every other caller hitting the same path.
 *
 * Key shape: `<userId>:<tenantId>:<url>` (falls back to ip when no user).
 * Only caches GETs (parent behaviour).
 */
@Injectable()
export class UserScopedCacheInterceptor extends CacheInterceptor {
  trackBy(context: ExecutionContext): string | undefined {
    const httpAdapter = this.httpAdapterHost.httpAdapter;
    const isHttpApp = httpAdapter && typeof httpAdapter.getRequestMethod === 'function';
    if (!isHttpApp) return undefined;

    const req = context.switchToHttp().getRequest<Request & { user?: { id?: string; tenantId?: string | null } }>();
    if (httpAdapter.getRequestMethod(req) !== 'GET') return undefined;

    const url = httpAdapter.getRequestUrl(req);
    const userId = req.user?.id ?? `anon:${req.ip ?? 'unknown'}`;
    const tenantId = req.user?.tenantId ?? 'no-tenant';
    return `${userId}:${tenantId}:${url}`;
  }
}
