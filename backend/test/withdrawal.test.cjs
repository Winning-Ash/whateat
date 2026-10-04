require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ConfigService } = require('@nestjs/config');
const { Test } = require('@nestjs/testing');
const { UnauthorizedException } = require('@nestjs/common');
const { WithdrawalService } = require('../dist/users/withdrawal.service');
const { UsersController } = require('../dist/users/users.controller');
const { KakaoAuthService } = require('../dist/auth/kakao-auth.service');
const { AuthService } = require('../dist/auth/auth.service');

function setup() {
  let records = { members: [{ _id: 'A', kakaoId: '123' }, { _id: 'B', kakaoId: '456' }],
    sessions: [{ userId: 'A', token: 'a1' }, { userId: 'A', token: 'a2' }, { userId: 'B', token: 'b1' }],
    likes: [{ userId: 'A' }, { userId: 'B' }], exclusions: [{ userId: 'A' }, { userId: 'B' }] };
  let failCleanup = false, unlinked = [];
  const auth = { me: async token => {
    const row = records.sessions.find(item => item.token === token);
    if (!row) throw new UnauthorizedException(); return { id: row.userId };
  } };
  const models = Object.fromEntries(Object.keys(records).map(name => [name, {
    findById: async id => records.members.find(row => row._id === id),
    deleteOne: async q => { records.members = records.members.filter(row => row._id !== q._id); },
    deleteMany: async q => { if (name === 'exclusions' && failCleanup) throw new Error('db failure');
      records[name] = records[name].filter(row => row.userId !== q.userId); },
  }]));
  const connection = { transaction: async work => {
    const snapshot = structuredClone(records);
    try { return await work({}); } catch (error) { records = snapshot; throw error; }
  } };
  const kakao = { unlink: async id => unlinked.push(id) };
  const service = new WithdrawalService(auth, kakao, connection, models.members, models.sessions, models.likes, models.exclusions);
  return { service, auth, kakao, records: () => records, unlinked, fail: value => { failCleanup = value; } };
}

test('withdrawal deletes only this member and every device session; unlink failure preserves all data', async () => {
  const f = setup();
  const initial = structuredClone(f.records());
  f.kakao.unlink = async () => { throw new Error('unlink failed'); };
  await assert.rejects(f.service.withdraw('a1'));
  assert.deepEqual(f.records(), initial);
  f.kakao.unlink = async id => { assert.equal(id, '123'); };
  await f.service.withdraw('a1');
  for (const rows of Object.values(f.records())) assert.equal(rows.length, 1);
  assert.equal(f.records().members[0]._id, 'B');
  await assert.rejects(f.auth.me('a2'), error => error.getStatus() === 401);
  assert.equal((await f.auth.me('b1')).id, 'B');
});

test('database failure rolls back all local deletion and supports retry', async () => {
  const f = setup();
  const initial = structuredClone(f.records());
  f.fail(true);
  await assert.rejects(f.service.withdraw('a1'), error => error.getStatus() === 503);
  assert.deepEqual(f.records(), initial);
  assert.equal(f.unlinked.length, 1);
  f.fail(false);
  await f.service.withdraw('a1');
  assert.equal(f.records().members.length, 1);
});

test('DELETE /users/me requires session and trusted origin, ignores client userId, clears cookies only after success', async () => {
  const f = setup();
  const module = await Test.createTestingModule({ controllers: [UsersController], providers: [
    { provide: WithdrawalService, useValue: f.service },
    { provide: ConfigService, useValue: new ConfigService({ FRONTEND_ORIGIN: 'http://localhost:5173',
      AUTH_COOKIE_SECURE: false, AUTH_COOKIE_SAME_SITE: 'lax' }) },
  ] }).compile();
  const app = module.createNestApplication({ logger: false });
  try {
    await app.listen(0, '127.0.0.1'); const url = (await app.getUrl()) + '/users/me';
    const req = (token, origin = 'http://localhost:5173') => fetch(url, { method: 'DELETE', headers: {
      Origin: origin, ...(token ? { Cookie: 'whateat_session=' + token } : {}), 'Content-Type': 'application/json',
    }, body: JSON.stringify({ userId: 'B' }) });
    assert.equal((await req()).status, 401);
    assert.equal((await req('expired')).status, 401);
    assert.equal((await req('a1', 'https://attacker.example')).status, 403);
    assert.equal((await req('a1', '')).status, 403);
    assert.equal(f.unlinked.length, 0);
    f.fail(true); const failed = await req('a1');
    assert.equal(failed.status, 503); assert.equal(failed.headers.get('set-cookie'), null);
    f.fail(false); const success = await req('a1');
    assert.equal(success.status, 204);
    assert.equal(success.headers.get('cache-control'), 'no-store');
    assert.equal(success.headers.getSetCookie().length, 2);
    assert.ok(success.headers.getSetCookie().every(cookie => cookie.includes('Expires=Thu, 01 Jan 1970')));
    assert.equal(f.records().members[0]._id, 'B');
  } finally { await app.close(); }
});

test('Kakao unlink uses server admin key, handles already-unlinked retry and hides upstream secrets', async t => {
  await assert.rejects(new KakaoAuthService(new ConfigService()).unlink('123'), e => e.getStatus() === 503);
  const service = new KakaoAuthService(new ConfigService({ KAKAO_ADMIN_KEY: 'private-admin' }));
  t.mock.method(global, 'fetch', async (url, options) => {
    assert.equal(url, 'https://kapi.kakao.com/v1/user/unlink');
    assert.equal(options.headers.Authorization, 'KakaoAK private-admin');
    assert.equal(options.body.get('target_id'), '123');
    assert.equal(options.body.get('target_id_type'), 'user_id');
    return { ok: true, status: 200, json: async () => ({ id: 123 }) };
  });
  await service.unlink('123');
  global.fetch.mock.mockImplementation(async () => ({ ok: false, status: 400, json: async () => ({ code: -101 }) }));
  await service.unlink('123');
  global.fetch.mock.mockImplementation(async () => ({ ok: false, status: 401, json: async () => ({ code: -401, msg: 'private-admin' }) }));
  await assert.rejects(service.unlink('123'), e => e.getStatus() === 502 && !e.message.includes('private-admin'));
});

test('member writes cannot create data for an already deleted account', async () => {
  let written = false;
  const auth = new AuthService({}, {}, { updateOne: async () => ({ matchedCount: 0 }) }, {}, {},
    { transaction: work => work({}) });
  await assert.rejects(auth.withMemberWrite('gone', async () => { written = true; }), e => e.getStatus() === 401);
  assert.equal(written, false);
});
