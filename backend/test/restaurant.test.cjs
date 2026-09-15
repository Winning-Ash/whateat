require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ConfigService } = require('@nestjs/config');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { createValidationPipe } = require('../dist/common/validation');
const { validateEnv } = require('../dist/config/env.validation');
const { MemoryCacheService } = require('../dist/cache/cache.service');
const { MemoryDailyCounter } = require('../dist/cache/daily-counter.service');
const { RestaurantService } = require('../dist/restaurant/restaurant.service');
const { KakaoService, DailyLimitException } = require('../dist/kakao/kakao.service');
const { distance } = require('../dist/common/utils/distance.util');
const query = { lat: 37.5, lng: 127, radius: 300 };
const doc = (id, lat = 37.5, lng = 127) => ({ id, place_name: '식당', address_name: '서울',
  road_address_name: '서울', x: String(lng), y: String(lat), category_name: '음식점 > 한식', place_url: 'https://place.map.kakao.com/' + id });
const result = (documents, total = documents.length, pageable = total, end = true) => ({
  documents, meta: { total_count: total, pageable_count: pageable, is_end: end },
});
function setup(search, overrides = {}) {
  const config = new ConfigService(validateEnv(overrides));
  const cache = new MemoryCacheService(config);
  return { service: new RestaurantService(config, cache, { search }), cache, config };
}

test('deduplicates, filters actual radius, shares nearby cache and coalesces concurrent requests', async () => {
  let calls = 0;
  const { service } = setup(async () => { calls++; await new Promise(r => setTimeout(r, 5));
    return result([doc('1'), doc('1'), doc('2', 37.503), doc('3', 38)]); });
  const values = await Promise.all(Array.from({ length: 10 }, () => service.random(query)));
  assert.equal(calls, 1);
  assert.ok(values.every(v => v.candidateCount === 1 && v.restaurant.id === '1'));
  const nearby = await service.candidates({ ...query, lat: 37.50001 });
  assert.equal(nearby.cached, true);
  assert.equal(calls, 1);
});

test('cacheOnly miss never queries Kakao; empty results are cached', async () => {
  let calls = 0;
  const { service } = setup(async () => { calls++; return result([]); });
  await assert.rejects(service.random({ ...query, cacheOnly: true }), e => e.getStatus() === 404);
  assert.equal(calls, 0);
  assert.equal((await service.candidates(query)).candidateCount, 0);
  await assert.rejects(service.random(query), e => e.getStatus() === 404);
  assert.equal(calls, 1);
});

test('sparse search paginates without subdivision', async () => {
  const pages = [];
  const { service } = setup(async (area, page) => {
    assert.equal(area.rect, undefined); pages.push(page);
    return result([doc(String(page))], 16, 16, page === 2);
  });
  assert.equal((await service.candidates(query)).candidateCount, 2);
  assert.deepEqual(pages, [1, 2]);
});

test('only capped areas subdivide and target stops further requests', async () => {
  const areas = [];
  const { service } = setup(async area => {
    areas.push(area);
    return areas.length === 1 ? result([doc('root')], 500, 45, false) : result([doc('child')]);
  }, { RESTAURANT_TARGET_COUNT: 2 });
  const value = await service.candidates(query);
  assert.equal(value.candidateCount, 2);
  assert.equal(value.partial, true);
  assert.equal(areas.length, 2);
  assert.equal(areas[0].x, query.lng);
  assert.equal(areas[1].rect.split(',').length, 4);
});

test('call budget and maximum depth bound dense duplicate results', async () => {
  let calls = 0;
  const { service } = setup(async () => { calls++; return result([doc('1')], 500, 45, false); },
    { RESTAURANT_MAX_CALLS: 3 });
  assert.equal((await service.candidates(query)).partial, true);
  assert.equal(calls, 3);
  let depthCalls = 0;
  const limited = setup(async (area, page) => { depthCalls++; assert.equal(area.rect, undefined);
    return result([doc(String(page))], 500, 45, page === 3); }, { RESTAURANT_MAX_DEPTH: 0 });
  assert.equal((await limited.service.candidates(query)).partial, true);
  assert.equal(depthCalls, 3);
});

test('daily limit preserves partial candidates and existing cache', async () => {
  let calls = 0;
  const { service } = setup(async () => {
    if (++calls > 1) throw new DailyLimitException();
    return result([doc('1')], 20, 20, false);
  });
  assert.equal((await service.random(query)).partial, true);
  assert.equal((await service.random(query)).cached, true);
  assert.equal(calls, 2);
  await assert.rejects(service.random({ ...query, radius: 400 }), e => e.getStatus() === 429);
});

test('failed searches clear pending state and are not cached', async () => {
  let calls = 0;
  const { service } = setup(async () => { if (++calls === 1) throw new Error('upstream'); return result([doc('1')]); });
  await assert.rejects(service.random(query));
  assert.equal((await service.random(query)).cached, false);
  assert.equal(calls, 2);
});

test('cache expires and capacity is bounded', async () => {
  const { cache } = setup(async () => result([]), { RESTAURANT_CACHE_MAX_ENTRIES: 1 });
  await cache.set('a', [], 10); await cache.set('b', [], 10);
  assert.equal(await cache.get('a'), undefined);
  await cache.set('c', [], -1);
  assert.equal(await cache.get('c'), undefined);
});

test('daily reservation is atomic for concurrent callers and resets by date', async () => {
  const counter = new MemoryDailyCounter();
  const accepted = await Promise.all(Array.from({ length: 100 }, () => counter.reserve('2026-09-15', 3)));
  assert.equal(accepted.filter(Boolean).length, 3);
  assert.equal(await counter.reserve('2026-09-16', 3), true);
  assert.equal(await counter.reserve('2026-09-16', 0), false);
});

test('missing key never consumes daily quota', async () => {
  const config = new ConfigService(validateEnv({}));
  const kakao = new KakaoService(config, { reserve: async () => { throw new Error('must not reserve'); } });
  await assert.rejects(kakao.search({}), e => e.getStatus() === 503);
});

test('Haversine uses meters and environment rejects dangerous configuration', () => {
  assert.equal(distance(query, query), 0);
  assert.ok(distance(query, { ...query, lat: 37.501 }) > 111);
  assert.throws(() => validateEnv({ KAKAO_DAILY_LIMIT: -1 }));
  assert.throws(() => validateEnv({ REDIS_URL: 'redis://localhost' }));
});

test('HTTP DTO validation rejects malformed location, unknown fields and invalid radius', async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(createValidationPipe());
  const kakao = app.get(KakaoService);
  let calls = 0;
  kakao.search = async () => { calls++; return result([doc('1')]); };
  try {
    await app.listen(0, '127.0.0.1');
    const url = await app.getUrl();
    for (const params of ['lat=37.5&lng=127&radius=99', 'lat=37.5&lng=127&radius=501',
      'lat=37.5&lng=127&radius=100.5', 'lat=NaN&lng=127&radius=300', 'radius=300',
      'lat=37.5&lng=127&radius=300&cacheOnly=1', 'lat=37.5&lng=127&radius=300&key=secret']) {
      assert.equal((await fetch(`${url}/restaurants/random?${params}`)).status, 400);
    }
    assert.equal(calls, 0);
    for (const radius of [100, 500]) {
      assert.equal((await fetch(`${url}/restaurants/random?lat=37.5&lng=127&radius=${radius}`)).status, 200);
    }
    const response = await fetch(`${url}/restaurants/random?lat=37.5&lng=127&radius=100&cacheOnly=true`);
    assert.equal((await response.json()).cached, true);
    assert.equal(calls, 2);
  } finally { await app.close(); }
});
