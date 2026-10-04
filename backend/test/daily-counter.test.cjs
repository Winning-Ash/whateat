require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ConfigService } = require('@nestjs/config');
const { MongoDailyCounter } = require('../dist/cache/mongo-daily-counter.service');
const { KakaoService } = require('../dist/kakao/kakao.service');

test('DB failures block Kakao HTTP requests without exposing database details', async () => {
  const previous = global.fetch;
  let requests = 0;
  global.fetch = async () => { requests++; throw new Error('must not call'); };
  try {
    const counter = new MongoDailyCounter({ updateOne: async () => { throw new Error('secret URI'); } });
    const service = new KakaoService(new ConfigService({ KAKAO_REST_API_KEY: 'test',
      KAKAO_DAILY_LIMIT: 7, KAKAO_COUNTER_TIMEZONE: 'Asia/Seoul' }), counter);
    await assert.rejects(() => service.search({}), error =>
      error.getStatus() === 503 && !error.message.includes('secret'));
    assert.equal(requests, 0);
  } finally { global.fetch = previous; }
});

test('duplicate reservation retries only a guarded update and reports exhausted quota', async () => {
  for (const modifiedCount of [0, 1]) {
    const calls = [];
    const counter = new MongoDailyCounter({ updateOne: async (...args) => {
      calls.push(args);
      if (calls.length === 1) throw { code: 11000 };
      return { modifiedCount };
    } });
    assert.equal(await counter.reserve('2026-10-04', 7), modifiedCount === 1);
    assert.deepEqual(calls[1], [{ _id: '2026-10-04', count: { $lt: 7 } }, { $inc: { count: 1 } }]);
  }
});

test('zero limit denies without writing and duplicate retry failures are sanitized', async () => {
  let writes = 0;
  const counter = new MongoDailyCounter({ updateOne: async () => {
    if (++writes === 1) throw { code: 11000 };
    throw new Error('secret URI');
  } });
  assert.equal(await counter.reserve('2026-10-04', 0), false);
  assert.equal(writes, 0);
  await assert.rejects(() => counter.reserve('2026-10-04', 7), error =>
    error.getStatus() === 503 && !error.message.includes('secret'));
});
