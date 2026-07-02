import { SetMetadata } from '@nestjs/common';
import { Capability } from '../capabilities';

export const CAPABILITIES_KEY = 'capabilities';

/**
 * Marks an endpoint as requiring at least one of the given capabilities.
 * Use instead of @Roles when the gate is "can act as a driver",
 * which depends on profile state, not on the User.role enum.
 */
export const RequireCapability = (...caps: Capability[]) =>
  SetMetadata(CAPABILITIES_KEY, caps);
