import { isIP } from 'node:net';

export function validateEnv(env: Record<string, unknown>) {
  const result = { ...env };
  const mongoUri = String(env.MONGODB_URI ?? '').trim();
  if (!/^mongodb(?:\+srv)?:\/\/\S+$/.test(mongoUri)) {
    throw new Error('MONGODB_URI must be a mongodb:// or mongodb+srv:// connection string');
  }
  result.MONGODB_URI = mongoUri;
  const databaseName = String(env.MONGODB_DB_NAME ?? 'whateat').trim();
  if (!/^[a-zA-Z0-9_-]{1,38}$/.test(databaseName)) {
    throw new Error('MONGODB_DB_NAME must contain 1-38 letters, digits, underscores or hyphens');
  }
  result.MONGODB_DB_NAME = databaseName;
  const dnsServers = String(env.MONGODB_DNS_SERVERS ?? '').trim();
  const servers = dnsServers ? dnsServers.split(',').map(server => server.trim()) : [];
  if (servers.some(server => !isIP(server))) {
    throw new Error('MONGODB_DNS_SERVERS must be comma-separated DNS server IP addresses');
  }
  result.MONGODB_DNS_SERVERS = servers;
  const production = env.NODE_ENV === 'production';
  const frontend = String(env.FRONTEND_ORIGIN || 'http://localhost:5173');
  try {
    const url = new URL(frontend);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash || (production && url.protocol !== 'https:')) throw new Error();
    result.FRONTEND_ORIGIN = url.origin;
  } catch { throw new Error('FRONTEND_ORIGIN must be an HTTP(S) origin (HTTPS in production)'); }
  const redirect = String(env.KAKAO_REDIRECT_URI || 'http://localhost:3000/auth/kakao/callback');
  try {
    const url = new URL(redirect);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/auth/kakao/callback' || url.search || url.hash ||
      (production && url.protocol !== 'https:')) throw new Error();
    result.KAKAO_REDIRECT_URI = redirect;
  } catch { throw new Error('KAKAO_REDIRECT_URI must point to /auth/kakao/callback (HTTPS in production)'); }
  const secure = env.AUTH_COOKIE_SECURE === undefined || env.AUTH_COOKIE_SECURE === ''
    ? production : String(env.AUTH_COOKIE_SECURE) === 'true';
  if (env.AUTH_COOKIE_SECURE !== undefined && env.AUTH_COOKIE_SECURE !== '' &&
    !['true', 'false'].includes(String(env.AUTH_COOKIE_SECURE))) throw new Error('AUTH_COOKIE_SECURE must be true or false');
  const sameSite = String(env.AUTH_COOKIE_SAME_SITE || 'lax');
  if (!['lax', 'none'].includes(sameSite) || (sameSite === 'none' && !secure) || (production && !secure)) {
    throw new Error('AUTH_COOKIE_SAME_SITE must be lax or none; none and production require secure cookies');
  }
  result.AUTH_COOKIE_SECURE = secure;
  result.AUTH_COOKIE_SAME_SITE = sameSite;
  const settings: Record<string, [number, number, number]> = {
    PORT: [3000, 1, 65535],
    AUTH_SESSION_TTL_SECONDS: [604800, 60, 2592000],
    KAKAO_DAILY_LIMIT: [95000, 0, 1000000000],
    KAKAO_TIMEOUT_MS: [5000, 100, 30000],
    RESTAURANT_CACHE_TTL: [3600, 1, 86400],
    RESTAURANT_TARGET_COUNT: [200, 1, 300],
    RESTAURANT_GRID_METERS: [50, 1, 100],
    RESTAURANT_MAX_CALLS: [30, 1, 100],
    RESTAURANT_MAX_DEPTH: [4, 0, 8],
    RESTAURANT_CACHE_MAX_ENTRIES: [1000, 1, 100000],
  };
  for (const [key, [fallback, min, max]] of Object.entries(settings)) {
    const value = env[key] === undefined || env[key] === '' ? fallback : Number(env[key]);
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(`${key} must be an integer between ${min} and ${max}`);
    }
    result[key] = value;
  }
  const timezone = String(env.KAKAO_COUNTER_TIMEZONE || 'Asia/Seoul');
  new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
  result.KAKAO_COUNTER_TIMEZONE = timezone;
  if (env.REDIS_URL) throw new Error('REDIS_URL requires Redis cache/counter adapters; memory fallback is disabled for safety.');
  return result;
}
