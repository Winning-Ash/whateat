require('reflect-metadata');
const assert = require('node:assert/strict');
const { Types } = require('mongoose');
const { NestFactory } = require('@nestjs/core');
const { getModelToken } = require('@nestjs/mongoose');
const { AppModule } = require('../dist/app.module');
const { AuthService } = require('../dist/auth/auth.service');
const { LikeListsService } = require('../dist/likes/like-lists.service');
const { LikesService } = require('../dist/likes/likes.service');

// Only random test member IDs are written or removed; no real Kakao API calls.
(async () => {
  let app, members, likes;
  const ids = [new Types.ObjectId(), new Types.ObjectId()];
  try {
    app = await NestFactory.createApplicationContext(AppModule, { logger: false, abortOnError: false });
    members = app.get(getModelToken('Member'));
    likes = app.get(getModelToken('Like'));
    const owner = ids[0].toString(), other = ids[1].toString();
    await members.create(ids.map(_id => ({ _id, kakaoId: 'like-lists-test-' + _id, nickname: 'Temporary list test' })));
    const auth = app.get(AuthService), lists = app.get(LikeListsService), items = app.get(LikesService);
    const write = work => auth.withMemberWrite(owner, work);
    const created = await Promise.allSettled(Array.from({ length: 5 }, (_, i) =>
      write(session => lists.create(owner, 'Test ' + i, session))));
    assert.equal(created.filter(result => result.status === 'fulfilled').length, 2);
    assert.ok(created.filter(result => result.status === 'rejected').every(result => result.reason.getStatus() === 409));
    const allLists = await lists.list(owner);
    assert.equal(allLists.length, 3);
    const [company, home] = allLists.slice(1);
    await assert.rejects(lists.requireList(other, company.id), error => error.getStatus() === 404);
    // Raw legacy fixture deliberately has no listIds field.
    await likes.collection.insertOne({ userId: ids[0], restaurantId: '99999999999999999999',
      restaurantName: 'Legacy test', createdAt: new Date() });
    const value = { restaurantId: '99999999999999999999', restaurantName: 'Legacy test' };
    await items.add(other, value);
    assert.equal((await items.listInList(owner, 'default')).length, 1);
    await write(session => items.addToList(owner, company.id, value, session));
    await write(session => items.addToList(owner, company.id, value, session));
    assert.equal((await items.listInList(owner, 'default')).length, 1);
    assert.equal((await items.listInList(owner, company.id)).length, 1);
    assert.equal((await items.list(owner)).length, 1);
    await write(session => items.addToList(owner, home.id, value, session));
    await write(session => items.removeFromList(owner, company.id, value.restaurantId, session));
    assert.equal((await items.listInList(owner, company.id)).length, 0);
    assert.equal((await items.listInList(owner, home.id)).length, 1);
    const originalUpdate = members.updateOne;
    members.updateOne = function(filter, update, options) {
      if (update.$pull?.likeLists) throw new Error('Injected metadata failure');
      return originalUpdate.call(this, filter, update, options);
    };
    try { await assert.rejects(write(session => lists.remove(owner, home.id, session))); }
    finally { members.updateOne = originalUpdate; }
    assert.equal((await items.listInList(owner, home.id)).length, 1);
    assert.equal((await lists.list(owner)).length, 3);
    await write(session => lists.rename(owner, home.id, '집 근처', session));
    await write(session => lists.remove(owner, home.id, session));
    assert.deepEqual((await items.list(owner))[0].listIds, ['default']);
    await write(session => items.addToList(owner, company.id,
      { restaurantId: '99999999999999999998', restaurantName: 'Only in company' }, session));
    await write(session => lists.remove(owner, company.id, session));
    assert.equal((await items.list(owner)).length, 1);
    await write(session => items.removeFromList(owner, 'default', value.restaurantId, session));
    assert.equal((await items.list(owner)).length, 0);
    assert.equal((await lists.list(other)).length, 1);
    assert.equal((await items.list(other)).length, 1);
    console.log('Atlas like lists passed: concurrent 3-list cap, legacy preservation, multiple memberships, idempotent add, scoped removal, rename, deletion rollback and member isolation.');
  } catch (error) {
    console.error('Atlas like lists check failed (' + error.name + ').'); process.exitCode = 1;
  } finally {
    try {
      if (likes) await likes.deleteMany({ userId: { $in: ids } });
      if (members) await members.deleteMany({ _id: { $in: ids } });
    } finally { if (app) await app.close(); }
  }
})();
