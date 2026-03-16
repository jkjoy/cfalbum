import { json, notFound } from '../../_lib/response.js';
import { cacheGet, cachePut } from '../../_lib/cache.js';
import { photoUrl, safeArrayJson } from '../../_lib/utils.js';

export async function onRequestGet(context) {
  const { env, params } = context;
  const slug = params.slug;
  const cacheKey = `cache:album:${slug}`;

  const cached = await cacheGet(env, cacheKey);
  if (cached) return json({ ...cached, cached: true });

  const album = await env.DB.prepare(`
    SELECT id, slug, title, description, cover_key, category, tags_json, created_at, updated_at
    FROM albums
    WHERE slug = ? AND is_public = 1
    LIMIT 1
  `).bind(slug).first();

  if (!album) return notFound('Album not found');

  const photosRes = await env.DB.prepare(`
    SELECT id, r2_key, width, height, sort_order, created_at
    FROM photos
    WHERE album_id = ?
    ORDER BY sort_order ASC, id ASC
  `).bind(album.id).all();

  const payload = {
    id: album.id,
    slug: album.slug,
    title: album.title,
    description: album.description,
    cover: photoUrl(env, album.cover_key),
    category: album.category,
    tags: safeArrayJson(album.tags_json),
    createdAt: album.created_at,
    updatedAt: album.updated_at,
    photos: (photosRes.results || []).map((p) => ({
      id: p.id,
      key: p.r2_key,
      url: photoUrl(env, p.r2_key),
      width: p.width,
      height: p.height,
      sortOrder: p.sort_order,
      createdAt: p.created_at
    }))
  };

  await cachePut(env, cacheKey, payload, 300);
  return json(payload);
}
