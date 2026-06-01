import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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

  // ── Common list filters ──
  // These are bound via the same `@Query() PaginationDto` object on list
  // routes that ALSO read them through separate `@Query('x')` params. With
  // the global ValidationPipe running `forbidNonWhitelisted: true`, any of
  // these keys appearing in the query string would otherwise be rejected
  // with HTTP 400 (breaking dashboard order/customer filters and the
  // worker walk-in search). Declaring them here whitelists them; the actual
  // filtering still happens via the controllers' typed `@Query('x')` reads.
  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsString()
  district?: string;

  @IsOptional() @IsString()
  driverId?: string;

  @IsOptional() @IsString()
  kind?: string;
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
