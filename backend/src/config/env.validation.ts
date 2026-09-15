export function validateEnv(env: Record<string, unknown>) {
  const result = { ...env };
  const settings: Record<string, [number, number, number]> = {
    PORT: [3000, 1, 65535],
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
