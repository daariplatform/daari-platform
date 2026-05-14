import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Ensures every authenticated request carries a tenantId so downstream
 * services can scope queries safely. Platform admins are exempt because
 * they may operate across tenants.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return true; // JwtAuthGuard already failed or skipped

    if (user.role === UserRole.PLATFORM_ADMIN) return true;
    if (!user.tenantId) {
      throw new ForbiddenException('User is not attached to a tenant');
    }
    req.tenantId = user.tenantId;
    return true;
  }
}
