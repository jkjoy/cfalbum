import { json } from '../_lib/response.js';
import { cacheGet, cachePut } from '../_lib/cache.js';

export async function onRequestGet(context) {
  const { env } = context;
  const cacheKey = 'cache:categories';
  const cached = await cacheGet(env, cacheKey);
  if (cached) return json({ ...cached, cached: true });

  const result = await env.DB.prepare(`
    SELECT category, COUNT(*) AS count
    FROM albums
    WHERE is_public = 1
    GROUP BY category
    ORDER BY count DESC, category ASC
  `).all();

  const payload = {
    items: (result.results || []).map((r) => ({ name: r.category, count: r.count }))
  };

  await cachePut(env, cacheKey, payload, 300);
  return json(payload);
}
