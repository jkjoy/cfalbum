import { parseCookies, sha256, clearSessionCookie } from './security.js';
import { unauthorized } from './response.js';

export async function requireAdmin(context) {
  const { request, env } = context;
  const cookieName = env.SESSION_COOKIE_NAME || 'cf_photo_session';
  const cookies = parseCookies(request);
  const token = cookies[cookieName];
  if (!token) return { error: unauthorized() };

  const tokenHash = await sha256(token);
  const stmt = env.DB.prepare(`
    SELECT s.id, s.admin_id, s.expires_at, a.username
    FROM sessions s
    JOIN admins a ON a.id = s.admin_id
    WHERE s.token_hash = ?
    LIMIT 1
  `).bind(tokenHash);
  const session = await stmt.first();

  if (!session) return { error: unauthorized() };
  const expired = Date.parse(`${session.expires_at}Z`) <= Date.now();
  if (expired) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(session.id).run();
    return {
      error: unauthorized('Session expired', {
        headers: { 'Set-Cookie': clearSessionCookie(cookieName) }
      })
    };
  }

  return { admin: { id: session.admin_id, username: session.username }, sessionId: session.id };
}
