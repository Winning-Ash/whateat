const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

if (!process.env.VITE_KAKAO_JAVASCRIPT_KEY?.trim()) {
  console.error('Set VITE_KAKAO_JAVASCRIPT_KEY on the combined Render Web Service before building.');
  process.exit(1);
}

// Force same-origin API requests in this deployment, even if an old API URL remains
// in Render or a local .env file. Backend secrets are never copied into VITE_* vars.
const env = { ...process.env, NODE_ENV: 'production', VITE_API_BASE_URL: '' };
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
for (const directory of ['frontend', 'backend']) {
  for (const args of [['ci', '--include=dev'], ['run', 'build']]) {
    const result = spawnSync(npm, args, {
      cwd: resolve(__dirname, '..', directory), env, stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (result.error || result.status !== 0) {
      console.error(`Render build failed in ${directory}.`);
      process.exit(result.status || 1);
    }
  }
}
