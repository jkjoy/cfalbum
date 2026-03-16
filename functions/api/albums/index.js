import { json, badRequest } from '../../_lib/response.js';
import { cacheGet, cachePut, homePageCacheKey } from '../../_lib/cache.js';
import { photoUrl, safeArrayJson, toInt } from '../../_lib/utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const page = Math.max(1, toInt(url.searchParams.get('page'), 1));
  const pageSize = Math.min(60, Math.max(1, toInt(url.searchParams.get('pageSize'), 24)));

  if (page < 1 || pageSize < 1) return badRequest('Invalid pagination');

  const cacheKey = homePageCacheKey(page, pageSize);
  const cached = await cacheGet(env, cacheKey);
  if (cached) return json({ ...cached, cached: true });

  const offset = (page - 1) * pageSize;
  const listSql = `
    SELECT
      a.id, a.slug, a.title, a.description, a.cover_key, a.category, a.tags_json,
      a.created_at,
      (SELECT COUNT(*) FROM photos p WHERE p.album_id = a.id) AS photo_count
    FROM albums a
    WHERE a.is_public = 1
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ? OFFSET ?
  `;
  const totalSql = `SELECT COUNT(*) AS total FROM albums WHERE is_public = 1`;

  const [listRes, totalRes] = await Promise.all([
    env.DB.prepare(listSql).bind(pageSize, offset).all(),
    env.DB.prepare(totalSql).first()
  ]);

  const items = (listRes.results || []).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    cover: photoUrl(env, row.cover_key),
    category: row.category,
    tags: safeArrayJson(row.tags_json),
    photoCount: row.photo_count || 0,
    createdAt: row.created_at
  }));

  const payload = {
    page,
    pageSize,
    total: totalRes?.total || 0,
    totalPages: Math.ceil((totalRes?.total || 0) / pageSize),
    items
  };

  await cachePut(env, cacheKey, payload, 300);
  return json(payload);
}
