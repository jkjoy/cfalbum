import { badRequest, json, notFound } from '../../../_lib/response.js';
import { requireAdmin } from '../../../_lib/auth.js';
import { cacheDeleteMany } from '../../../_lib/cache.js';
import { getHomepageInvalidationKeys } from '../../../_lib/settings.js';
import { getJson, safeArrayJson, slugify } from '../../../_lib/utils.js';

function normalizeTags(input) {
  if (Array.isArray(input)) return input.map((x) => String(x).trim()).filter(Boolean);
  if (typeof input === 'string') return input.split(',').map((x) => x.trim()).filter(Boolean);
  return [];
}

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  const id = Number.parseInt(context.params.id, 10);
  if (!Number.isFinite(id)) return badRequest('Invalid album id');

  const { env } = context;
  const album = await env.DB.prepare('SELECT * FROM albums WHERE id = ? LIMIT 1').bind(id).first();
  if (!album) return notFound('Album not found');

  const photos = await env.DB.prepare('SELECT * FROM photos WHERE album_id = ? ORDER BY sort_order ASC, id ASC').bind(id).all();
  return json({
    album: {
      ...album,
      tags: safeArrayJson(album.tags_json)
    },
    photos: photos.results || []
  });
}

export async function onRequestPut(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  const id = Number.parseInt(context.params.id, 10);
  if (!Number.isFinite(id)) return badRequest('Invalid album id');

  const { env } = context;
  const current = await env.DB.prepare('SELECT * FROM albums WHERE id = ? LIMIT 1').bind(id).first();
  if (!current) return notFound('Album not found');

  const body = await getJson(context.request);
  if (!body) return badRequest('Invalid JSON body');

  const title = String(body.title ?? current.title).trim();
  if (!title) return badRequest('Title is required');

  let slug = String(body.slug ?? current.slug).trim();
  if (!slug) slug = slugify(title);
  if (!slug) return badRequest('Slug is required');

  const existingSlug = await env.DB.prepare('SELECT id FROM albums WHERE slug = ? AND id != ? LIMIT 1').bind(slug, id).first();
  if (existingSlug) return badRequest('Slug already exists');

  const description = String(body.description ?? current.description).trim();
  const category = String(body.category ?? current.category).trim() || '默认分类';
  const coverKey = String(body.coverKey ?? current.cover_key ?? '').trim() || null;
  const tags = normalizeTags(body.tags ?? safeArrayJson(current.tags_json));
  const isPublic = body.isPublic === undefined ? current.is_public : (body.isPublic ? 1 : 0);

  await env.DB.prepare(`
    UPDATE albums
    SET slug = ?, title = ?, description = ?, cover_key = ?, category = ?, tags_json = ?, is_public = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(slug, title, description, coverKey, category, JSON.stringify(tags), isPublic, id).run();

  const homeKeys = await getHomepageInvalidationKeys(env);
  await cacheDeleteMany(env, [`cache:album:${current.slug}`, `cache:album:${slug}`, 'cache:categories', ...homeKeys]);

  const updated = await env.DB.prepare('SELECT * FROM albums WHERE id = ?').bind(id).first();
  return json({ ok: true, album: updated });
}

export async function onRequestDelete(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  const id = Number.parseInt(context.params.id, 10);
  if (!Number.isFinite(id)) return badRequest('Invalid album id');

  const { env } = context;
  const album = await env.DB.prepare('SELECT id, slug FROM albums WHERE id = ? LIMIT 1').bind(id).first();
  if (!album) return notFound('Album not found');

  const photoRows = await env.DB.prepare('SELECT r2_key FROM photos WHERE album_id = ?').bind(id).all();
  await Promise.all((photoRows.results || []).map((row) => env.BUCKET.delete(row.r2_key)));

  await env.DB.prepare('DELETE FROM albums WHERE id = ?').bind(id).run();
  const homeKeys = await getHomepageInvalidationKeys(env);
  await cacheDeleteMany(env, [`cache:album:${album.slug}`, 'cache:categories', ...homeKeys]);

  return json({ ok: true });
}
