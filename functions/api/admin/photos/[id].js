import { badRequest, json, notFound } from '../../../_lib/response.js';
import { requireAdmin } from '../../../_lib/auth.js';
import { cacheDeleteMany } from '../../../_lib/cache.js';
import { getHomepageInvalidationKeys } from '../../../_lib/settings.js';

export async function onRequestDelete(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  const photoId = Number.parseInt(context.params.id, 10);
  if (!Number.isFinite(photoId)) return badRequest('Invalid photo id');

  const { env } = context;
  const row = await env.DB.prepare(`
    SELECT p.id, p.r2_key, p.album_id, a.slug, a.cover_key
    FROM photos p
    JOIN albums a ON a.id = p.album_id
    WHERE p.id = ?
    LIMIT 1
  `).bind(photoId).first();

  if (!row) return notFound('Photo not found');

  await env.BUCKET.delete(row.r2_key);
  await env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(photoId).run();

  if (row.cover_key === row.r2_key) {
    const replacement = await env.DB.prepare('SELECT r2_key FROM photos WHERE album_id = ? ORDER BY sort_order ASC, id ASC LIMIT 1').bind(row.album_id).first();
    await env.DB.prepare('UPDATE albums SET cover_key = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(replacement?.r2_key || null, row.album_id).run();
  }

  const homeKeys = await getHomepageInvalidationKeys(env);
  await cacheDeleteMany(env, [`cache:album:${row.slug}`, ...homeKeys]);
  return json({ ok: true });
}
