/**
 * Shared test-app boot helper.
 *
 * createTestApp() spins up a NestJS TestingModule with the real AppModule,
 * applies the same global pipes as production (main.ts), and verifies the
 * Prisma connection. If the DB is unreachable, the function throws a clean
 * error so the calling suite can call `describeIfDb` to skip rather than
 * tear the entire run down.
 *
 * truncateAll() empties every domain table between tests. Order matters
 * because Prisma's `Cascade` on Tenant doesn't reach every dependent row.
 * We use TRUNCATE ... CASCADE so PG sorts the FK graph itself.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  moduleRef: TestingModule;
}

let cached: TestContext | null = null;

export async function createTestApp(): Promise<TestContext> {
  if (cached) return cached;

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  const prisma = app.get(PrismaService);
  // Sanity ping so suites fail early with a clear message instead of
  // dripping cryptic Prisma errors into every test.
  await prisma.$queryRaw`SELECT 1`;

  cached = { app, prisma, moduleRef };
  return cached;
}

export async function closeTestApp(): Promise<void> {
  if (!cached) return;
  await cached.app.close();
  cached = null;
}

/**
 * Quickly empty every domain table. Uses one `TRUNCATE ... CASCADE` for
 * all relevant tables so FK order doesn't matter. System tables
 * (_prisma_migrations, pg_*) are left alone.
 */
export async function truncateAll(prisma: PrismaService): Promise<void> {
  // SAFETY GUARD: never wipe a non-test database. If a real DATABASE_URL is
  // exported in the shell (CI, direnv, a server session), `npm test` must not
  // TRUNCATE it. Refuse unless the connected DB name ends in `_test`.
  const [{ current_database: dbName }] = await prisma.$queryRaw<
    { current_database: string }[]
  >`SELECT current_database()`;
  if (!/_test$/i.test(dbName)) {
    throw new Error(
      `Refusing to truncate database "${dbName}": its name must end in "_test". ` +
        `Point DATABASE_URL_TEST at a dedicated test database (e.g. maa_platform_test).`,
    );
  }

  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE '\\_%' ESCAPE '\\'
      AND tablename NOT LIKE 'spatial_%';
  `;
  const tables = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
  if (!tables) return;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables} RESTART IDENTITY CASCADE;`);
}

/**
 * Jest helper — replaces `describe(...)` with a version that skips the
 * whole suite when the DB isn't reachable. Resolves the readiness check
 * once at module load.
 *
 * Usage:
 *   describeIfDb('feature', () => { it(...); });
 */
export function describeIfDb(name: string, fn: () => void): void {
  // We can't await at top level inside Jest's describe — so we mark the
  // suite skipped *eagerly* if env hints it can't work, and otherwise let
  // the beforeAll() blow up with a real diagnostic.
  if (!process.env.DATABASE_URL) {
    describe.skip(`${name} [skipped: DATABASE_URL_TEST not set]`, fn);
    return;
  }
  describe(name, fn);
}
