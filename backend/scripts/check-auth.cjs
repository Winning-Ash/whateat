require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { getModelToken } = require('@nestjs/mongoose');
const { createHash } = require('node:crypto');
const { AppModule } = require('../dist/app.module');

// Uses Atlas, creates one temporary OAuth state, then consumes/removes only that state.
// Does not sign a user in, exchange Kakao tokens or create a member.
(async () => {
  let app, state;
  try {
    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const start = await fetch(base + '/auth/kakao', { redirect: 'manual' });
    if (start.status !== 302) throw new Error();
    const location = new URL(start.headers.get('location'));
    state = location.searchParams.get('state');
    if (location.origin !== 'https://kauth.kakao.com' || !state) throw new Error();
    const cookie = start.headers.getSetCookie()[0].split(';')[0];
    const cancel = await fetch(base + '/auth/kakao/callback?error=access_denied&state=' + state,
      { redirect: 'manual', headers: { Cookie: cookie } });
    if (cancel.status !== 302 || !cancel.headers.get('location').endsWith('/?login=failed')) throw new Error();
    if ((await fetch(base + '/auth/me')).status !== 401) throw new Error();
    console.log('Auth smoke check passed: Atlas models/indexes, login redirect, cancellation and unauthenticated 401.');
  } catch {
    console.error('Auth smoke check failed. Check database and Kakao login environment settings.');
    process.exitCode = 1;
  } finally {
    if (app) {
      try {
        if (state) await app.get(getModelToken('LoginState')).deleteOne({ tokenHash: createHash('sha256').update(state).digest('hex') });
      } finally { await app.close(); }
    }
  }
})();
