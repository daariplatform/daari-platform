import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Capability } from '../capabilities';
import { CAPABILITIES_KEY } from '../decorators/capabilities.decorator';

@Injectable()
export class CapabilitiesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Capability[]>(CAPABILITIES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = ctx.switchToHttp().getRequest();
    const caps: Capability[] = user?.capabilities ?? [];
    const ok = required.some((r) => caps.includes(r));
    if (!ok) {
      throw new ForbiddenException(
        `Requires capability: ${required.join(' or ')} (have: ${caps.join(', ') || 'none'})`,
      );
    }
    return true;
  }
}
