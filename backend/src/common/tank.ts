import { TankCapacity } from '@prisma/client';

/**
 * Litres delivered per tank capacity — the single source of truth.
 *
 * This map used to be inlined (with contradictory fallbacks) in four places:
 * orders (defaulted unknown → 350), and ai / plant (defaulted → 0). Adding a
 * new `TankCapacity` enum value therefore silently produced wrong stock and
 * receipt figures. Typed as `Record<TankCapacity, number>`, the compiler now
 * forces every enum value to be mapped here — a new capacity won't build until
 * its litres are declared.
 */
export const LITERS_BY_CAPACITY: Record<TankCapacity, number> = {
  L350: 350,
  L500: 500,
};
