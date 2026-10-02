require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Test } = require('@nestjs/testing');
const { ConfigService } = require('@nestjs/config');
const { UnauthorizedException } = require('@nestjs/common');
const { AuthService } = require('../dist/auth/auth.service');
const { LikesController } = require('../dist/likes/likes.controller');
const { LikesService } = require('../dist/likes/likes.service');
const { LikeSchema } = require('../dist/likes/likes.schema');
const { createValidationPipe } = require('../dist/common/validation');

test('likes require login, enforce Origin and validation, isolate members and allow idempotent add/remove', async () => {
  const rows = new Map();
  const key = q => q.userId + ':' + q.restaurantId;
  const model = { init: async () => {},
    updateOne: async (q, update) => rows.set(key(q), { ...q, ...update.$set, createdAt: new Date() }),
    deleteOne: async q => rows.delete(key(q)),
    find: q => ({ select: () => ({ sort: () => ({ lean: async () => [...rows.values()]
      .filter(row => row.userId === q.userId).map(({ userId, ...row }) => row) }) }) }),
  };
  const module = await Test.createTestingModule({ controllers: [LikesController], providers: [
    { provide: LikesService, useValue: new LikesService(model) },
    { provide: ConfigService, useValue: new ConfigService({ FRONTEND_ORIGIN: 'http://localhost:5173' }) },
    { provide: AuthService, useValue: { me: async token => {
      if (!['A', 'B'].includes(token)) throw new UnauthorizedException(); return { id: token };
    } } },
  ] }).compile();
  const app = module.createNestApplication({ logger: false });
  app.useGlobalPipes(createValidationPipe());
  try {
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const req = (user, method = 'GET', body, suffix = '', origin = 'http://localhost:5173') => fetch(base + '/users/me/likes' + suffix, {
      method, headers: { ...(user ? { Cookie: 'whateat_session=' + user } : {}), Origin: origin,
        ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const value = { restaurantId: '123', restaurantName: '좋은 식당' };
    for (const user of [undefined, 'expired']) {
      assert.equal((await req(user)).status, 401);
      assert.equal((await req(user, 'POST', value)).status, 401);
      assert.equal((await req(user, 'DELETE', undefined, '/123')).status, 401);
    }
    assert.equal((await req('A', 'POST', value, '', 'https://evil.example')).status, 403);
    assert.equal((await req('A', 'DELETE', undefined, '/123', '')).status, 403);
    for (const body of [{ ...value, userId: 'B' }, { ...value, restaurantId: 'bad' },
      { ...value, restaurantName: '  ' }, { ...value, restaurantName: 'x'.repeat(301) }]) {
      assert.equal((await req('A', 'POST', body)).status, 400);
    }
    assert.equal((await req('A', 'DELETE', undefined, '/bad')).status, 400);
    assert.equal((await req('A', 'POST', value)).status, 204);
    assert.equal((await req('A', 'POST', { ...value, restaurantName: '새 이름' })).status, 204);
    assert.equal(rows.size, 1);
    const list = await req('A');
    assert.equal(list.headers.get('cache-control'), 'no-store');
    const data = await list.json();
    assert.equal(data.likes[0].restaurantName, '새 이름');
    assert.equal(data.likes[0].userId, undefined);
    assert.equal((await (await req('B')).json()).likes.length, 0);
    await req('B', 'DELETE', undefined, '/123');
    assert.equal(rows.size, 1);
    await req('B', 'POST', value);
    assert.equal(rows.size, 2);
    await req('A', 'DELETE', undefined, '/123');
    assert.equal((await req('A', 'DELETE', undefined, '/123')).status, 204);
    assert.equal((await (await req('B')).json()).likes.length, 1);
  } finally { await app.close(); }
});

test('likes have compound unique index and retry duplicate races with the original owner', async () => {
  const calls = [];
  const service = new LikesService({ updateOne: async (...args) => {
    calls.push(args); if (calls.length === 1) throw { code: 11000 };
  } });
  await service.add('A', { restaurantId: '1', restaurantName: '식당' });
  assert.deepEqual(calls[0][0], calls[1][0]);
  assert.equal(calls[1][2].upsert, undefined);
  assert.ok(LikeSchema.indexes().some(([keys, options]) => keys.userId && keys.restaurantId && options.unique));
});
