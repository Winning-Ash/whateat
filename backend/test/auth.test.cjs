require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { ConfigService } = require('@nestjs/config');
const { Test } = require('@nestjs/testing');
const { AuthService } = require('../dist/auth/auth.service');
const { AuthController } = require('../dist/auth/auth.controller');
const { KakaoAuthService } = require('../dist/auth/kakao-auth.service');
const { validateEnv } = require('../dist/config/env.validation');
const { MemberSchema, LoginSessionSchema, LoginStateSchema } = require('../dist/auth/auth.schemas');
const hash = value => createHash('sha256').update(value).digest('hex');
const config = () => new ConfigService(validateEnv({ MONGODB_URI: 'mongodb://localhost/test',
  KAKAO_REST_API_KEY: 'test-key', KAKAO_CLIENT_SECRET: 'test-secret' }));

function setup() {
  const members = new Map(), sessions = new Map(), states = new Map();
  let calls = 0;
  const find = (map, query) => {
    const item = map.get(query.tokenHash);
    return item && (!query.expiresAt || item.expiresAt > query.expiresAt.$gt) ? item : null;
  };
  const memberModel = {
    init: async () => {},
    updateOne: async q => ({ matchedCount: [...members.values()].some(member => member._id === q._id) ? 1 : 0 }),
    findOneAndUpdate: async (query, update) => {
      const member = members.get(query.kakaoId) || { _id: 'internal-user-1', createdAt: new Date() };
      Object.assign(member, update.$set); members.set(query.kakaoId, member); return member;
    },
    findById: async id => [...members.values()].find(member => member._id === id),
  };
  const sessionModel = { init: async () => {}, create: async items => {
    const item = items[0]; sessions.set(item.tokenHash, item);
  },
    findOne: async query => find(sessions, query), deleteOne: async query => sessions.delete(query.tokenHash) };
  const stateModel = { init: async () => {}, create: async item => states.set(item.tokenHash, item),
    findOneAndDelete: async query => { const item = find(states, query); if (item) states.delete(query.tokenHash); return item; } };
  const settings = config();
  const provider = { authorizeUrl: state => new KakaoAuthService(settings).authorizeUrl(state),
    profile: async () => { calls++; return { kakaoId: '12345', nickname: '테스터' }; } };
  const auth = new AuthService(settings, provider, memberModel, sessionModel, stateModel, { transaction: work => work({}) });
  const login = async previous => { const { state } = await auth.start(); return auth.finish(state, state, 'code', undefined, previous); };
  return { auth, settings, login, members, sessions, states, provider, calls: () => calls };
}

test('first login creates member; repeat login reuses member and rotates session', async () => {
  const f = setup();
  const first = await f.login();
  assert.equal(f.sessions.has(hash(first.token)), true);
  assert.equal(JSON.stringify([...f.sessions.values()]).includes(first.token), false);
  assert.equal((await f.auth.me(first.token)).nickname, '테스터');
  const second = await f.login(first.token);
  assert.notEqual(second.token, first.token);
  assert.equal(f.members.size, 1);
  await assert.rejects(f.auth.me(first.token), error => error.getStatus() === 401);
  assert.deepEqual(Object.keys(await f.auth.me(second.token)).sort(), ['createdAt', 'id', 'nickname']);
  await f.auth.logout(second.token);
  await assert.rejects(f.auth.me(second.token), error => error.getStatus() === 401);
});

test('state binds browser, is single-use and checks expiry before provider calls', async () => {
  const f = setup();
  const { state } = await f.auth.start();
  await assert.rejects(f.auth.finish(state, '0'.repeat(64), 'code'), error => error.getStatus() === 400);
  assert.equal(f.calls(), 0);
  const results = await Promise.allSettled([f.auth.finish(state, state, 'code'), f.auth.finish(state, state, 'code')]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(f.calls(), 1);
  const expired = await f.auth.start();
  f.states.get(hash(expired.state)).expiresAt = new Date(0);
  await assert.rejects(f.auth.finish(expired.state, expired.state, 'code'));
  const cancelled = await f.auth.start();
  await assert.rejects(f.auth.finish(cancelled.state, cancelled.state, undefined, 'access_denied'));
  await assert.rejects(f.auth.finish(cancelled.state, cancelled.state, 'code'));
  assert.equal(f.calls(), 1);
});

test('expired sessions and deleted members cannot authenticate; failed provider creates no session', async () => {
  const f = setup();
  const session = await f.login();
  f.sessions.get(hash(session.token)).expiresAt = new Date(0);
  await assert.rejects(f.auth.me(session.token), error => error.getStatus() === 401);
  const second = await f.login();
  f.members.clear();
  await assert.rejects(f.auth.me(second.token), error => error.getStatus() === 401);
  f.provider.profile = async () => { throw new Error('provider failed'); };
  const count = f.sessions.size;
  await assert.rejects(f.login());
  assert.equal(f.sessions.size, count);
});

test('HTTP flow sets HttpOnly cookies, returns profile and requires trusted Origin on logout', async () => {
  const f = setup();
  const module = await Test.createTestingModule({ controllers: [AuthController], providers: [
    { provide: AuthService, useValue: f.auth }, { provide: ConfigService, useValue: f.settings },
  ] }).compile();
  const app = module.createNestApplication({ logger: false });
  app.enableCors({ origin: 'http://localhost:5173', credentials: true });
  try {
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const start = await fetch(base + '/auth/kakao', { redirect: 'manual' });
    assert.equal(start.status, 302);
    const stateCookie = start.headers.getSetCookie()[0];
    assert.match(stateCookie, /HttpOnly/); assert.match(stateCookie, /SameSite=Lax/);
    const location = new URL(start.headers.get('location'));
    assert.equal(location.origin, 'https://kauth.kakao.com');
    assert.equal(location.searchParams.get('client_id'), 'test-key');
    assert.equal(location.searchParams.has('client_secret'), false);
    const callbackUrl = base + '/auth/kakao/callback?code=code&state=' + location.searchParams.get('state');
    const callback = await fetch(callbackUrl, { redirect: 'manual', headers: { Cookie: stateCookie.split(';')[0] } });
    assert.equal(callback.headers.get('location'), 'http://localhost:5173');
    const sessionCookie = callback.headers.getSetCookie().find(cookie => cookie.startsWith('whateat_session='));
    assert.match(sessionCookie, /HttpOnly/);
    const cookie = sessionCookie.split(';')[0];
    const me = await fetch(base + '/auth/me', { headers: { Cookie: cookie, Origin: 'http://localhost:5173' } });
    assert.equal(me.status, 200);
    assert.equal(me.headers.get('access-control-allow-credentials'), 'true');
    assert.equal(me.headers.get('cache-control'), 'no-store');
    assert.equal((await me.json()).user.nickname, '테스터');
    const replay = await fetch(callbackUrl, { redirect: 'manual', headers: { Cookie: stateCookie.split(';')[0] } });
    assert.equal(replay.headers.get('location'), 'http://localhost:5173/?login=failed');
    for (const origin of [undefined, 'https://attacker.example']) {
      const response = await fetch(base + '/auth/logout', { method: 'POST', headers: { Cookie: cookie, ...(origin ? { Origin: origin } : {}) } });
      assert.equal(response.status, 403);
    }
    const logout = await fetch(base + '/auth/logout', { method: 'POST', headers: { Cookie: cookie, Origin: 'http://localhost:5173' } });
    assert.equal(logout.status, 204);
    assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
    assert.equal((await fetch(base + '/auth/me', { headers: { Cookie: cookie } })).status, 401);
  } finally { await app.close(); }
});

test('Kakao token exchange stays on server and failures never expose credentials', async t => {
  const client = new KakaoAuthService(config());
  let calls = 0;
  t.mock.method(global, 'fetch', async (url, options) => {
    calls++;
    if (calls === 1) {
      assert.equal(url, 'https://kauth.kakao.com/oauth/token');
      assert.equal(options.body.get('client_secret'), 'test-secret');
      assert.equal(options.body.get('redirect_uri'), 'http://localhost:3000/auth/kakao/callback');
      return { ok: true, json: async () => ({ access_token: 'private-token' }) };
    }
    assert.equal(options.headers.Authorization, 'Bearer private-token');
    return { ok: true, json: async () => ({ id: 123 }) };
  });
  assert.deepEqual(await client.profile('test-code'), { kakaoId: '123', nickname: '회원' });
  global.fetch.mock.mockImplementation(async () => { throw new Error('test-secret private-token'); });
  await assert.rejects(client.profile('test-code'), error => error.getStatus() === 502 && !error.message.includes('test-secret'));
});

test('cookie configuration rejects insecure production and schemas enforce identity/TTL indexes', () => {
  const base = { MONGODB_URI: 'mongodb://localhost/test' };
  assert.throws(() => validateEnv({ ...base, AUTH_COOKIE_SAME_SITE: 'none' }));
  assert.throws(() => validateEnv({ ...base, FRONTEND_ORIGIN: 'https://example.com/untrusted/path' }));
  assert.throws(() => validateEnv({ ...base, NODE_ENV: 'production' }));
  const prod = validateEnv({ ...base, NODE_ENV: 'production', FRONTEND_ORIGIN: 'https://app.example.com',
    KAKAO_REDIRECT_URI: 'https://api.example.com/auth/kakao/callback' });
  assert.equal(prod.AUTH_COOKIE_SECURE, true);
  assert.ok(MemberSchema.indexes().some(([keys, options]) => keys.kakaoId && options.unique));
  for (const schema of [LoginStateSchema, LoginSessionSchema]) {
    assert.ok(schema.indexes().some(([keys, options]) => keys.expiresAt && options.expireAfterSeconds === 0));
  }
});
