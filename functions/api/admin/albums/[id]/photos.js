import { badRequest, json, notFound } from '../../../../_lib/response.js';
import { requireAdmin } from '../../../../_lib/auth.js';
import { cacheDeleteMany } from '../../../../_lib/cache.js';
import { getHomepageInvalidationKeys } from '../../../../_lib/settings.js';

function sanitizeFilename(name) {
  return String(name || 'file')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
}

export async function onRequestPost(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  const albumId = Number.parseInt(context.params.id, 10);
  if (!Number.isFinite(albumId)) return badRequest('Invalid album id');

  const { env, request } = context;
  const album = await env.DB.prepare('SELECT id, slug, cover_key FROM albums WHERE id = ? LIMIT 1').bind(albumId).first();
  if (!album) return notFound('Album not found');

  const form = await request.formData();
  const files = form.getAll('photos').filter((f) => typeof f?.arrayBuffer === 'function');
  if (!files.length) return badRequest('photos field is required');

  const currentMax = await env.DB.prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM photos WHERE album_id = ?').bind(albumId).first();
  let sortOrder = Number.parseInt(currentMax?.max_sort || 0, 10);

  const uploaded = [];
  for (const file of files) {
    sortOrder += 1;
    const filename = sanitizeFilename(file.name || `photo-${sortOrder}`);
    const key = `original/${albumId}/${Date.now()}-${crypto.randomUUID()}-${filename}`;
    await env.BUCKET.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type || 'application/octet-stream' }
    });

    const insert = await env.DB.prepare(`
      INSERT INTO photos (album_id, r2_key, width, height, sort_order)
      VALUES (?, ?, NULL, NULL, ?)
    `).bind(albumId, key, sortOrder).run();

    uploaded.push({ id: insert.meta.last_row_id, key, sortOrder, name: file.name || filename });
  }

  if (!album.cover_key && uploaded[0]) {
    await env.DB.prepare('UPDATE albums SET cover_key = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(uploaded[0].key, albumId).run();
  }

  const homeKeys = await getHomepageInvalidationKeys(env);
  await cacheDeleteMany(env, [`cache:album:${album.slug}`, ...homeKeys]);
  return json({ ok: true, uploaded });
}
