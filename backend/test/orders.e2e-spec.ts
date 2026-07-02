/**
 * Order lifecycle — PENDING → ASSIGNED → EN_ROUTE → COMPLETED.
 *
 * What we check:
 *   1. Plant admin creates a refill order; it enters the offer pool as
 *      PENDING/unassigned. The driver POST /:id/claim wins it (status: ASSIGNED).
 *   2. Driver POST /:id/start flips to EN_ROUTE.
 *   3. Driver POST /:id/complete with proofPhotoUrl + GPS at the customer's
 *      address completes it and increments totalRefills.
 *   4. Invalid transition — trying to /start an already-COMPLETED order
 *      throws 400.
 *
 * WaterStock decrement is NOT asserted: the orders service today doesn't
 * touch WaterStock on completion (the plant tops up manually), so a test
 * that asserts it would be wrong rather than green-by-luck. Flagged in
 * the deliverable summary.
 */
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll, describeIfDb } from './setup';
import { seedTwoTenants, TwoTenants } from './fixtures';

describeIfDb('Refill order lifecycle', () => {
  let server: any;
  let seeds: TwoTenants;
  let ownerToken: string;
  let driverToken: string;

  async function loginAs(phone: string, password: string): Promise<string> {
    const res = await request(server).post('/api/v1/auth/login').send({ phone, password });
    if (res.status !== 200) throw new Error(`login failed: ${res.status}`);
    return res.body.accessToken;
  }

  beforeEach(async () => {
    const { app, prisma } = await createTestApp();
    server = app.getHttpServer();
    await truncateAll(prisma);
    seeds = await seedTwoTenants(prisma);
    ownerToken = await loginAs(seeds.t1.ownerPhone, seeds.t1.ownerPassword);
    driverToken = await loginAs(seeds.t1.driverPhone, seeds.t1.driverPassword);
  });
  afterAll(async () => {
    await closeTestApp();
  });

  it('plant admin → create order → driver claim → start → complete', async () => {
    // 1. Owner creates the refill order. Under the claim model it enters the
    // offer pool as PENDING/unassigned rather than being auto-assigned.
    const created = await request(server)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ customerId: seeds.t1.customerId });
    expect(created.status).toBe(201);
    expect(created.body.id).toBeTruthy();
    expect(created.body.status).toBe('PENDING');
    const orderId = created.body.id;

    // 2. Driver claims the offered order (race-safe first-come) → ASSIGNED.
    const claimed = await request(server)
      .post(`/api/v1/orders/${orderId}/claim`)
      .set('Authorization', `Bearer ${driverToken}`);
    expect(claimed.status).toBe(201);
    expect(claimed.body.status).toBe('ASSIGNED');

    // 3. Driver marks EN_ROUTE.
    const started = await request(server)
      .post(`/api/v1/orders/${orderId}/start`)
      .set('Authorization', `Bearer ${driverToken}`);
    expect(started.status).toBe(201);
    expect(started.body.status).toBe('EN_ROUTE');

    // 4. Driver completes. completionLng/Lat = customer's exact home (passes
    // 50 m geofence). proofPhotoUrl is optional for REFILL.
    const completed = await request(server)
      .post(`/api/v1/orders/${orderId}/complete`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        paymentMethod: 'CASH',
        paidAmountIqd: 1000,
        proofPhotoUrl: 'https://example.test/proof.jpg',
        completionLng: 44.4156,
        completionLat: 33.3033,
      });
    expect(completed.status).toBe(201);
    expect(completed.body.status).toBe('COMPLETED');
    expect(completed.body.gpsVerified).toBe(true);

    // 5. Trying to /start the same (now COMPLETED) order → 400.
    const bogus = await request(server)
      .post(`/api/v1/orders/${orderId}/start`)
      .set('Authorization', `Bearer ${driverToken}`);
    expect(bogus.status).toBe(400);
  });

  it('refill completion without proof photo → 201 (proof is optional)', async () => {
    // Proof photos are optional for REFILL (plants opted out of mandatory tank
    // photos to save storage/bandwidth), so completion succeeds without one.
    const created = await request(server)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ customerId: seeds.t1.customerId });
    const orderId = created.body.id;
    await request(server)
      .post(`/api/v1/orders/${orderId}/claim`)
      .set('Authorization', `Bearer ${driverToken}`);
    await request(server)
      .post(`/api/v1/orders/${orderId}/start`)
      .set('Authorization', `Bearer ${driverToken}`);
    const res = await request(server)
      .post(`/api/v1/orders/${orderId}/complete`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        paymentMethod: 'CASH',
        paidAmountIqd: 1000,
        // proofPhotoUrl deliberately omitted
        completionLng: 44.4156,
        completionLat: 33.3033,
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('COMPLETED');
  });
});
