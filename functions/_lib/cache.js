export const SITE_SETTINGS_CACHE_KEY = 'cache:site:settings';

export function homePageCacheKey(page, pageSize) {
  return `cache:home:page:${page}:size:${pageSize}`;
}

export async function cacheGet(env, key) {
  if (!env.CACHE) return null;
  const raw = await env.CACHE.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function cachePut(env, key, value, ttl = 300) {
  if (!env.CACHE) return;
  await env.CACHE.put(key, JSON.stringify(value), { expirationTtl: ttl });
}

export async function cacheDeleteMany(env, keys = []) {
  if (!env.CACHE || !keys.length) return;
  await Promise.all(keys.map((k) => env.CACHE.delete(k)));
}
