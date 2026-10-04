require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ConfigService } = require('@nestjs/config');
const { MongoCacheService } = require('../dist/cache/mongo-cache.service');

test('cache database failures are sanitized and fail closed', async () => {
  const fail = () => { throw new Error('secret connection detail'); };
  const cache = new MongoCacheService({ findOne: fail, updateOne: fail }, new ConfigService());
  for (const operation of [() => cache.get('key'), () => cache.set('key', [], 60)]) {
    await assert.rejects(operation, error => error.getStatus() === 503 && !error.message.includes('secret'));
  }
});

test('cache reads require unexpired entries even before TTL cleanup', async () => {
  let filter;
  const cache = new MongoCacheService({ findOne: query => {
    filter = query;
    return { lean: async () => null };
  } }, new ConfigService());
  assert.equal(await cache.get('key'), undefined);
  assert.equal(filter._id, 'key');
  assert.ok(filter.expiresAt.$gt instanceof Date);
});
