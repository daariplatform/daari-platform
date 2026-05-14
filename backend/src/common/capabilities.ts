/**
 * Capabilities are derived from User.role + which side-profiles
 * (Driver, Vendor) the user has. Unlike role, a user can hold many.
 *
 *  customer       — can place refill / delivery orders for themselves
 *  driver         — has an active Driver profile attached to a plant
 *  vendor         — has an approved Vendor profile (independent)
 *  plant_admin    — owner / manager / accountant of a plant
 *  platform_admin — operates the platform itself
 */
export type Capability =
  | 'customer'
  | 'driver'
  | 'vendor'
  | 'plant_admin'
  | 'platform_admin';
