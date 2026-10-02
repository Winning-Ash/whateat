require('reflect-metadata');
const assert = require('node:assert/strict');
const { NestFactory } = require('@nestjs/core');
const { Types } = require('mongoose');
const { AppModule } = require('../dist/app.module');
const { LikesService } = require('../dist/likes/likes.service');

// Uses fresh random owner IDs; never changes a real member's likes.
(async () => {
  let app, service;
  const owner = new Types.ObjectId().toString();
  const other = new Types.ObjectId().toString();
  const restaurantId = '99999999999999999999';
  try {
    app = await NestFactory.createApplicationContext(AppModule, { logger: false, abortOnError: false });
    service = app.get(LikesService);
    const value = { restaurantId, restaurantName: 'Temporary like smoke test' };
    await Promise.all([service.add(owner, value), service.add(owner, value)]);
    assert.equal((await service.list(owner)).length, 1);
    assert.deepEqual(await service.ids(owner), [restaurantId]);
    assert.equal((await service.list(other)).length, 0);
    await service.remove(other, restaurantId);
    assert.equal((await service.list(owner)).length, 1);
    await service.remove(owner, restaurantId);
    assert.equal((await service.list(owner)).length, 0);
    console.log('Atlas likes check passed: upsert, unique index, owner isolation, listing and deletion.');
  } catch {
    console.error('Atlas likes check failed.');
    process.exitCode = 1;
  } finally {
    try { if (service) await service.remove(owner, restaurantId); }
    finally { if (app) await app.close(); }
  }
})();
