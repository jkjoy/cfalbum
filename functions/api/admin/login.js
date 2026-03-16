import bcrypt from 'bcryptjs';
import { createSessionCookie, sha256 } from '../../_lib/security.js';
import { badRequest, json, unauthorized } from '../../_lib/response.js';
import { getJson } from '../../_lib/utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await getJson(request);
    if (!body) return badRequest('Invalid JSON body');

    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!username || !password) return badRequest('Username and password are required');

    const admin = await env.DB.prepare('SELECT id, username, password_hash FROM admins WHERE username = ? LIMIT 1')
      .bind(username)
      .first();
    if (!admin) return unauthorized('Invalid credentials');

    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) return unauthorized('Invalid credentials');

    const token = crypto.randomUUID() + crypto.randomUUID();
    const tokenHash = await sha256(token);
    const sessionId = crypto.randomUUID();
    const maxAge = Number.parseInt(env.SESSION_MAX_AGE_SECONDS || '1209600', 10);
    const expiresAt = new Date(Date.now() + maxAge * 1000).toISOString().slice(0, 19).replace('T', ' ');

    await env.DB.prepare('INSERT INTO sessions (id, admin_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
      .bind(sessionId, admin.id, tokenHash, expiresAt)
      .run();

    const cookieName = env.SESSION_COOKIE_NAME || 'cf_photo_session';
    return json(
      { ok: true, username: admin.username },
      { headers: { 'Set-Cookie': createSessionCookie(cookieName, token, maxAge) } }
    );
  } catch (error) {
    return json(
      {
        error: 'Login failed',
        details: String(error?.message || error)
      },
      { status: 500 }
    );
  }
}
