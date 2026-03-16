import { requireAdmin } from '../../_lib/auth.js';
import { clearSessionCookie } from '../../_lib/security.js';
import { json } from '../../_lib/response.js';

export async function onRequestPost(context) {
  const { env } = context;
  const auth = await requireAdmin(context);
  const cookieName = env.SESSION_COOKIE_NAME || 'cf_photo_session';

  if (auth.sessionId) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(auth.sessionId).run();
  }

  return json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie(cookieName) } });
}
