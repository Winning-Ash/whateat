require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Test } = require('@nestjs/testing');
const { ConfigService } = require('@nestjs/config');
const { UnauthorizedException } = require('@nestjs/common');
const { AuthService } = require('../dist/auth/auth.service');
const { ExclusionsService } = require('../dist/exclusions/exclusions.service');
const { ExclusionsController } = require('../dist/exclusions/exclusions.controller');
const { ExclusionSchema } = require('../dist/exclusions/exclusions.schema');
const { RestaurantController } = require('../dist/restaurant/restaurant.controller');
const { RestaurantService } = require('../dist/restaurant/restaurant.service');
const { MemoryCacheService } = require('../dist/cache/cache.service');
const { validateEnv } = require('../dist/config/env.validation');
const { createValidationPipe } = require('../dist/common/validation');

test('member exclusions are isolated, idempotent and merged with query filters without mutating cache', async () => {
  const rows = new Map();
  const key = q => q.userId + ':' + q.restaurantId;
  const model = {
    init: async () => {},
    updateOne: async (q, update) => rows.set(key(q), { ...q, ...update.$set, createdAt: new Date() }),
    deleteOne: async q => rows.delete(key(q)),
    distinct: async (_, q) => [...rows.values()].filter(row => row.userId === q.userId).map(row => row.restaurantId),
    find: q => ({ select: () => ({ sort: () => ({ lean: async () => [...rows.values()]
      .filter(row => row.userId === q.userId).map(({ userId, ...row }) => row) }) }) }),
  };
  const exclusions = new ExclusionsService(model);
  const config = new ConfigService(validateEnv({ MONGODB_URI: 'mongodb://localhost/test' }));
  let calls = 0;
  const restaurants = new RestaurantService(config, new MemoryCacheService(config), { search: async () => {
    calls++;
    return { documents: ['1', '2'].map(id => ({ id, place_name: '식당 ' + id, x: '127', y: '37.5',
      address_name: '서울', road_address_name: '서울', category_name: '음식점 > 한식', place_url: '' })),
    meta: { total_count: 2, pageable_count: 2, is_end: true } };
  } });
  const auth = { me: async token => { if (!['A', 'B'].includes(token)) throw new UnauthorizedException(); return { id: token }; } };
  const module = await Test.createTestingModule({ controllers: [ExclusionsController, RestaurantController], providers: [
    { provide: ExclusionsService, useValue: exclusions }, { provide: AuthService, useValue: auth },
    { provide: ConfigService, useValue: config }, { provide: RestaurantService, useValue: restaurants },
  ] }).compile();
  const app = module.createNestApplication({ logger: false });
  app.useGlobalPipes(createValidationPipe());
  try {
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const request = (path, user, method = 'GET', body, origin = 'http://localhost:5173') => fetch(base + path, {
      method, headers: { ...(user ? { Cookie: 'whateat_session=' + user } : {}), Origin: origin,
        ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const endpoint = '/users/me/exclusions';
    const value = { restaurantId: '1', restaurantName: '식당 1' };
    for (const method of ['GET', 'POST', 'DELETE']) {
      assert.equal((await request(endpoint + (method === 'DELETE' ? '/1' : ''), undefined, method, method === 'POST' ? value : undefined)).status, 401);
    }
    assert.equal((await request(endpoint, 'A', 'POST', value, 'https://other.example')).status, 403);
    for (const bad of [{ ...value, userId: 'B' }, { ...value, restaurantId: 'invalid' }, { ...value, restaurantName: '   ' }]) {
      assert.equal((await request(endpoint, 'A', 'POST', bad)).status, 400);
    }
    assert.equal((await request(endpoint + '/invalid', 'A', 'DELETE')).status, 400);
    assert.equal((await request(endpoint, 'A', 'POST', value)).status, 204);
    assert.equal((await request(endpoint, 'A', 'POST', value)).status, 204);
    assert.equal(rows.size, 1);
    assert.equal((await (await request(endpoint, 'B')).json()).exclusions.length, 0);
    assert.equal((await request(endpoint + '/1', 'B', 'DELETE')).status, 204);
    const list = await request(endpoint, 'A');
    assert.equal(list.headers.get('cache-control'), 'no-store');
    assert.equal((await list.json()).exclusions.length, 1);
    const query = '?lat=37.5&lng=127&radius=300';
    assert.equal((await (await request('/restaurants/random' + query, 'A')).json()).restaurant.id, '2');
    assert.equal((await (await request('/restaurants/candidates' + query, 'B')).json()).candidateCount, 2);
    assert.equal((await (await request('/restaurants/random' + query + '&excludeIds=2')).json()).restaurant.id, '1');
    assert.equal((await request('/restaurants/random' + query + '&excludeIds=2', 'A')).status, 404);
    assert.equal((await request('/restaurants/random' + query, 'expired')).status, 401);
    assert.equal((await request(endpoint + '/1', 'A', 'DELETE')).status, 204);
    assert.equal((await (await request('/restaurants/candidates' + query, 'A')).json()).candidateCount, 2);
    assert.equal(calls, 1);
    model.distinct = async () => { throw new Error('database unavailable'); };
    assert.equal((await request('/restaurants/random' + query, 'A')).status, 500);
  } finally { await app.close(); }
});

test('concurrent insert collision retries only the same member and restaurant', async () => {
  const updates = [];
  const service = new ExclusionsService({ updateOne: async (...args) => {
    updates.push(args);
    if (updates.length === 1) throw { code: 11000 };
  } });
  await service.add('user-a', { restaurantId: '123', restaurantName: '이름' });
  assert.deepEqual(updates[0][0], updates[1][0]);
  assert.equal(updates[1][2].upsert, undefined);
  assert.ok(ExclusionSchema.indexes().some(([keys, options]) => keys.userId && keys.restaurantId && options.unique));
});
