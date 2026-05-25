/**
 * Jest config — e2e harness for the maa-platform NestJS backend.
 *
 * - Test files: `test/*.e2e-spec.ts`
 * - Transform with ts-jest (no separate compile step)
 * - 30 s timeout per test (Prisma bootstrap is slow on cold start)
 * - Single worker (`maxWorkers: 1`) so tests share one DB without
 *   stepping on each other inside `truncateAll()` — until we add
 *   per-test transactional isolation, parallel runs will collide.
 * - `--detectOpenHandles` friendly: setup file closes app + prisma in
 *   afterAll, and we don't leave Redis/BullMQ connections hanging
 *   (REDIS_HOST=disabled in test env).
 */
import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/test'],
  testRegex: '\\.e2e-spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  testTimeout: 30_000,
  maxWorkers: 1,
  // Keep noise low — Nest's logger is muted in setup-env.
  silent: false,
  verbose: false,
};

export default config;
