import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Capability } from '../capabilities';

export interface AuthUser {
  id: string;
  phone: string;
  role: UserRole;
  tenantId: string | null;
  capabilities: Capability[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    return ctx.switchToHttp().getRequest().user;
  },
);
