import { json, badRequest, notFound } from '../../../_lib/response.js';
import { requireAdmin } from '../../../_lib/auth.js';
import { cacheDeleteMany } from '../../../_lib/cache.js';
import { getHomepageInvalidationKeys } from '../../../_lib/settings.js';
import { getJson, safeArrayJson, slugify, toInt } from '../../../_lib/utils.js';

function normalizeTags(input) {
  if (Array.isArray(input)) return input.map((x) => String(x).trim()).filter(Boolean);
  if (typeof input === 'string') return input.split(',').map((x) => x.trim()).filter(Boolean);
  return [];
}

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  const { env } = context;
  const list = await env.DB.prepare(`
    SELECT a.id, a.slug, a.title, a.description, a.cover_key, a.category, a.tags_json, a.is_public, a.created_at, a.updated_at,
      (SELECT COUNT(*) FROM photos p WHERE p.album_id = a.id) AS photo_count
    FROM albums a
    ORDER BY a.created_at DESC, a.id DESC
  `).all();

  return json({
    items: (list.results || []).map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      coverKey: row.cover_key,
      category: row.category,
      tags: safeArrayJson(row.tags_json),
      isPublic: row.is_public === 1,
      photoCount: toInt(row.photo_count, 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  });
}

export async function onRequestPost(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  const { env } = context;
  const body = await getJson(context.request);
  if (!body) return badRequest('Invalid JSON body');

  const title = String(body.title || '').trim();
  if (!title) return badRequest('Title is required');

  let slug = String(body.slug || '').trim();
  if (!slug) slug = slugify(title);
  if (!slug) return badRequest('Slug is required');

  const description = String(body.description || '').trim();
  const category = String(body.category || '默认分类').trim() || '默认分类';
  const tags = normalizeTags(body.tags);
  const isPublic = body.isPublic === false ? 0 : 1;

  const exists = await env.DB.prepare('SELECT id FROM albums WHERE slug = ? LIMIT 1').bind(slug).first();
  if (exists) return badRequest('Slug already exists');

  const insert = await env.DB.prepare(`
    INSERT INTO albums (slug, title, description, category, tags_json, is_public)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(slug, title, description, category, JSON.stringify(tags), isPublic).run();

  const homeKeys = await getHomepageInvalidationKeys(env);
  await cacheDeleteMany(env, ['cache:categories', ...homeKeys]);

  const created = await env.DB.prepare('SELECT * FROM albums WHERE id = ?').bind(insert.meta.last_row_id).first();
  if (!created) return notFound('Create failed');

  return json({ ok: true, album: created });
}
