import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Shared pagination contract for all list endpoints.
 *
 * - `page`     — 1-indexed page number (default 1)
 * - `pageSize` — items per page (default 50, max 200)
 *
 * Controllers should:
 *   list(@Query() pq: PaginationDto, ...) { ... }
 *
 * Services should return:
 *   { items, total, page, pageSize, totalPages }
 *
 * Implemented with `Prisma.$transaction([findMany, count])` so the count
 * stays consistent with the page, and skip/take are derived from
 * (page - 1) * pageSize / pageSize.
 *
 * The `@Type(() => Number)` is required because query-string values arrive
 * as strings; without it class-validator's `@IsInt` rejects them.
 */
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize: number = 50;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Helper to assemble the paginated envelope from a (items, total, dto) tuple. */
export function paginated<T>(
  items: T[],
  total: number,
  dto: { page: number; pageSize: number },
): PaginatedResult<T> {
  const totalPages = total === 0 ? 0 : Math.ceil(total / dto.pageSize);
  return {
    items,
    total,
    page: dto.page,
    pageSize: dto.pageSize,
    totalPages,
  };
}
