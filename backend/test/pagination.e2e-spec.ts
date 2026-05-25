/**
 * Pagination — covers the trio:
 *   1. default-paged response carries the right page-size envelope
 *   2. page 2 does NOT overlap with page 1 (skip math is correct)
 *   3. oversized pageSize is rejected by PaginationDto (max 200)
 *
 * If page-2 ever overlaps page-1, customers see duplicate rows in the
 * dashboard and the plant admin gets confused.
 */
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll, describeIfDb } from './setup';
import { seedTwoTenants, seedManyCustomers, TwoTenants } from './fixtures';

describeIfDb('GET /api/v1/customers (pagination)', () => {
  let server: any;
  let seeds: TwoTenants;
  let token: string;

  beforeAll(async () => {
    const { app, prisma } = await createTestApp();
    server = app.getHttpServer();
    await truncateAll(prisma);
    seeds = await seedTwoTenants(prisma);
    // T1 already has 1 customer from seedTwoTenants; add 55 more → 56 total.
    await seedManyCustomers(prisma, seeds.t1.tenantId, 55);

    const login = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone: seeds.t1.ownerPhone, password: seeds.t1.ownerPassword });
    token = login.body.accessToken;
  });
  afterAll(async () => {
    await closeTestApp();
  });

  it('page 1 / pageSize 10 → 10 items, totalPages ≥ 6', async () => {
    const res = await request(server)
      .get('/api/v1/customers?page=1&pageSize=10')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(10);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(10);
    expect(res.body.total).toBeGreaterThanOrEqual(55);
    expect(res.body.totalPages).toBeGreaterThanOrEqual(6);
  });

  it('page 2 ids do not overlap page 1 ids', async () => {
    const p1 = await request(server)
      .get('/api/v1/customers?page=1&pageSize=10')
      .set('Authorization', `Bearer ${token}`);
    const p2 = await request(server)
      .get('/api/v1/customers?page=2&pageSize=10')
      .set('Authorization', `Bearer ${token}`);
    const ids1 = new Set(p1.body.items.map((c: any) => c.id));
    const overlap = p2.body.items.filter((c: any) => ids1.has(c.id));
    expect(overlap).toEqual([]);
    expect(p2.body.items.length).toBeGreaterThan(0);
  });

  it('pageSize=500 is rejected (max 200) by PaginationDto validation', async () => {
    const res = await request(server)
      .get('/api/v1/customers?page=1&pageSize=500')
      .set('Authorization', `Bearer ${token}`);
    // ValidationPipe surfaces this as a 400 because @Max(200) on PaginationDto.
    expect(res.status).toBe(400);
  });
});
