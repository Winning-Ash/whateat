require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Test } = require('@nestjs/testing');
const { ConfigService } = require('@nestjs/config');
const { UnauthorizedException } = require('@nestjs/common');
const { AuthService } = require('../dist/auth/auth.service');
const { LikeListsService } = require('../dist/likes/like-lists.service');
const { LikeListsController } = require('../dist/likes/like-lists.controller');
const { LikesService } = require('../dist/likes/likes.service');
const { createValidationPipe } = require('../dist/common/validation');

function fixture() {
  const members = { A: {}, B: {} };
  const removed = [];
  const model = {
    findById: id => ({ session: () => ({ lean: async () => members[id] }) }),
    updateOne: async (q, update) => {
      const member = members[q._id];
      if (update.$push) (member.likeLists ??= []).push(update.$push.likeLists);
      if (update.$set?.defaultLikeListName) member.defaultLikeListName = update.$set.defaultLikeListName;
      if (update.$set?.['likeLists.$.name']) member.likeLists.find(list => list.id === q['likeLists.id']).name = update.$set['likeLists.$.name'];
      if (update.$pull) member.likeLists = member.likeLists.filter(list => list.id !== update.$pull.likeLists.id);
    },
  };
  const likes = { removeList: async (...args) => removed.push(args),
    listInList: async () => [], addToList: async (...args) => removed.push(args), removeFromList: async (...args) => removed.push(args) };
  return { service: new LikeListsService(model, likes), likes, removed, members };
}

test('lists preserve implicit default, enforce capacity and names, scope access and prohibit default deletion', async () => {
  const { service, removed } = fixture();
  assert.deepEqual(await service.list('A'), [{ id: 'default', name: '기본' }]);
  const company = await service.create('A', '회사', {});
  await assert.rejects(service.create('A', '회사', {}), error => error.getStatus() === 409);
  const home = await service.create('A', '집 근처', {});
  await assert.rejects(service.create('A', '네 번째', {}), error => error.getStatus() === 409);
  await assert.rejects(service.requireList('B', company.id), error => error.getStatus() === 404);
  await assert.rejects(service.remove('B', company.id, {}), error => error.getStatus() === 404);
  await assert.rejects(service.remove('A', 'default', {}), error => error.getStatus() === 400);
  await assert.rejects(service.rename('A', home.id, '회사', {}), error => error.getStatus() === 409);
  await service.rename('A', 'default', '자주 가는 곳', {});
  await service.rename('A', company.id, '직장', {});
  assert.deepEqual((await service.list('A')).map(list => list.name), ['자주 가는 곳', '직장', '집 근처']);
  await service.remove('A', home.id, {});
  assert.deepEqual(removed[0].slice(0, 2), ['A', home.id]);
  await service.create('A', '새 목록', {});
  assert.equal((await service.list('A')).length, 3);
  assert.equal((await service.list('B')).length, 1);
  await assert.rejects(service.list('missing'), error => error.getStatus() === 401);
});

test('list HTTP APIs require login and trusted Origin, validate inputs and reject another member list', async () => {
  const f = fixture();
  const module = await Test.createTestingModule({ controllers: [LikeListsController], providers: [
    { provide: LikeListsService, useValue: f.service }, { provide: LikesService, useValue: f.likes },
    { provide: ConfigService, useValue: new ConfigService({ FRONTEND_ORIGIN: 'http://localhost:5173' }) },
    { provide: AuthService, useValue: { me: async token => {
      if (!['A', 'B'].includes(token)) throw new UnauthorizedException(); return { id: token };
    }, withMemberWrite: async (id, work) => work({}) } },
  ] }).compile();
  const app = module.createNestApplication({ logger: false });
  app.useGlobalPipes(createValidationPipe());
  try {
    await app.listen(0, '127.0.0.1');
    const base = (await app.getUrl()) + '/users/me/like-lists';
    const req = (user, method = 'GET', suffix = '', body, origin = 'http://localhost:5173') => fetch(base + suffix, {
      method, headers: { Origin: origin, ...(user ? { Cookie: 'whateat_session=' + user } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    for (const [method, suffix, body] of [['GET', ''], ['POST', '', { name: '회사' }],
      ['PATCH', '/default', { name: '기본' }], ['DELETE', '/default'], ['GET', '/default/likes'],
      ['POST', '/default/likes', { restaurantId: '1', restaurantName: '식당' }], ['DELETE', '/default/likes/1']]) {
      assert.equal((await req(undefined, method, suffix, body)).status, 401);
      if (method !== 'GET') assert.equal((await req('A', method, suffix, body, 'https://evil.example')).status, 403);
    }
    for (const body of [{ name: '  ' }, { name: 'x'.repeat(31) }, { name: '회사', userId: 'B' }]) {
      assert.equal((await req('A', 'POST', '', body)).status, 400);
    }
    assert.equal((await req('A', 'GET', '/invalid/likes')).status, 400);
    const created = await req('A', 'POST', '', { name: ' 회사 ' });
    assert.equal(created.status, 201);
    const { list } = await created.json();
    assert.equal(list.name, '회사');
    const value = { restaurantId: '1', restaurantName: '식당' };
    for (const [method, suffix, body] of [['GET', `/${list.id}/likes`],
      ['POST', `/${list.id}/likes`, value], ['DELETE', `/${list.id}/likes/1`],
      ['PATCH', `/${list.id}`, { name: '이름' }], ['DELETE', `/${list.id}`]]) {
      assert.equal((await req('B', method, suffix, body)).status, 404);
    }
    assert.equal(f.removed.length, 0);
    assert.equal((await req('A', 'POST', `/${list.id}/likes`, { ...value, listId: 'default' })).status, 400);
    assert.equal((await req('A', 'POST', `/${list.id}/likes`, value)).status, 204);
    assert.equal((await req('A', 'DELETE', `/${list.id}/likes/1`)).status, 204);
    assert.equal((await req('A', 'DELETE', `/${list.id}/likes/bad`)).status, 400);
    const result = await req('A');
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.equal((await result.json()).lists.length, 2);
  } finally { await app.close(); }
});
