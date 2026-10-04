require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const { getConnectionToken } = require('@nestjs/mongoose');
const { Module } = require('@nestjs/common');
const { ConfigModule, ConfigService } = require('@nestjs/config');
const { validateEnv } = require('../dist/config/env.validation');
const { DatabaseModule } = require('../dist/database/database.module');
const { MongoCacheService, CandidateCacheSchema } = require('../dist/cache/mongo-cache.service');
class CacheCheckModule {}
Module({ imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }), DatabaseModule] })(CacheCheckModule);

(async () => {
  let app, model;
  const collection = 'cache_check_' + randomUUID().replaceAll('-', '');
  try {
    app = await NestFactory.createApplicationContext(CacheCheckModule, { logger: false, abortOnError: false });
    const connection = app.get(getConnectionToken());
    model = connection.model('CacheCheck', CandidateCacheSchema, collection);
    const config = new ConfigService({ RESTAURANT_CACHE_MAX_ENTRIES: 2 });
    const writer = new MongoCacheService(model, config);
    const reader = new MongoCacheService(model, config);
    await writer.onModuleInit();
    const indexes = await model.collection.indexes();
    assert.ok(indexes.some(index => index.key.expiresAt === 1 && index.expireAfterSeconds === 0));
    await writer.set('shared', { restaurants: [{ id: '1' }], partial: false }, 3600);
    assert.deepEqual(await reader.get('shared'), { restaurants: [{ id: '1' }], partial: false });
    await model.updateOne({ _id: 'shared' }, { $set: { expiresAt: new Date(0) } });
    assert.equal(await reader.get('shared'), undefined);
    await writer.set('empty', { restaurants: [], partial: false }, 3600);
    assert.deepEqual(await reader.get('empty'), { restaurants: [], partial: false });
    await model.updateOne({ _id: 'empty' }, { $set: { writtenAt: new Date(0) } });
    await writer.set('next', ['2'], 3600);
    await writer.set('latest', ['3'], 3600);
    assert.equal(await reader.get('empty'), undefined);
    assert.equal(await model.countDocuments(), 2);
    await Promise.all([writer.set('same', ['4'], 3600), reader.set('same', ['4'], 3600)]);
    assert.deepEqual(await reader.get('same'), ['4']);
    console.log('MongoDB cache check passed: shared reads, expiration, empty results, capacity, concurrent writes and TTL index.');
  } catch {
    console.error('MongoDB cache check failed. Check database connectivity and cache implementation.');
    process.exitCode = 1;
  } finally {
    try {
      if (model && /^cache_check_[a-f0-9]{32}$/.test(collection)) await model.collection.drop();
    } catch (error) {
      if (error.code !== 26) { console.error('Temporary cache collection cleanup failed.'); process.exitCode = 1; }
    }
    if (app) await app.close();
  }
})();
