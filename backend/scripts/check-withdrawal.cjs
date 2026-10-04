require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomBytes, createHash } = require('node:crypto');
const { Types } = require('mongoose');
const { NestFactory } = require('@nestjs/core');
const { getModelToken } = require('@nestjs/mongoose');
const { AppModule } = require('../dist/app.module');
const { AuthService } = require('../dist/auth/auth.service');
const { KakaoAuthService } = require('../dist/auth/kakao-auth.service');
const { WithdrawalService } = require('../dist/users/withdrawal.service');
const { LikesService } = require('../dist/likes/likes.service');

// Only generated test members are touched. Kakao unlink is replaced in-process;
// this command never disconnects a real Kakao account.
(async () => {
  let app, models;
  const ids = [new Types.ObjectId(), new Types.ObjectId()];
  const tokens = Array.from({ length: 3 }, () => randomBytes(32).toString('hex'));
  try {
    app = await NestFactory.createApplicationContext(AppModule, { logger: false, abortOnError: false });
    models = Object.fromEntries(['Member', 'LoginSession', 'Like', 'Exclusion'].map(name => [name, app.get(getModelToken(name))]));
    for (const id of ids) {
      await models.Member.create({ _id: id, kakaoId: 'withdrawal-test-' + id, nickname: 'Temporary withdrawal test' });
      await models.Like.create({ userId: id, restaurantId: '99999999999999999999', restaurantName: 'Temporary test' });
      await models.Exclusion.create({ userId: id, restaurantId: '99999999999999999999', restaurantName: 'Temporary test' });
    }
    for (let i = 0; i < tokens.length; i++) await models.LoginSession.create({
      userId: ids[i === 2 ? 1 : 0], tokenHash: createHash('sha256').update(tokens[i]).digest('hex'), expiresAt: new Date(Date.now() + 600000),
    });
    app.get(KakaoAuthService).unlink = async kakaoId => { assert.equal(kakaoId, 'withdrawal-test-' + ids[0]); };
    const withdrawal = app.get(WithdrawalService);
    const original = models.Exclusion.deleteMany;
    models.Exclusion.deleteMany = () => { throw new Error('Injected transaction failure'); };
    try { await assert.rejects(withdrawal.withdraw(tokens[0]), e => e.getStatus() === 503); }
    finally { models.Exclusion.deleteMany = original; }
    assert.ok(await models.Member.exists({ _id: ids[0] }));
    assert.equal(await models.Like.countDocuments({ userId: ids[0] }), 1);
    const auth = app.get(AuthService);
    await auth.withMemberWrite(ids[0].toString(), session => app.get(LikesService).add(ids[0].toString(),
      { restaurantId: '99999999999999999998', restaurantName: 'Transactional write' }, session));
    await withdrawal.withdraw(tokens[0]);
    assert.equal(await models.Member.countDocuments({ _id: ids[0] }), 0);
    for (const name of ['LoginSession', 'Like', 'Exclusion']) {
      assert.equal(await models[name].countDocuments({ userId: ids[0] }), 0);
      assert.equal(await models[name].countDocuments({ userId: ids[1] }), 1);
    }
    await assert.rejects(auth.me(tokens[1]), e => e.getStatus() === 401);
    await assert.rejects(auth.withMemberWrite(ids[0].toString(), async () => { throw new Error('Must not run'); }), e => e.getStatus() === 401);
    console.log('Atlas withdrawal passed: rollback, complete cleanup, all-session revocation, member isolation. Kakao unlink was mocked.');
  } catch {
    console.error('Withdrawal smoke check failed. No real Kakao account was unlinked.'); process.exitCode = 1;
  } finally {
    try {
      if (models) {
        for (const name of ['LoginSession', 'Like', 'Exclusion']) await models[name].deleteMany({ userId: { $in: ids } });
        await models.Member.deleteMany({ _id: { $in: ids } });
      }
    } finally { if (app) await app.close(); }
  }
})();
