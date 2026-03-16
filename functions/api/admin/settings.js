import { json, badRequest } from '../../_lib/response.js';
import { requireAdmin } from '../../_lib/auth.js';
import { getSiteSettings, getSettingsSchema, updateSiteSettings } from '../../_lib/settings.js';

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  const settings = await getSiteSettings(context.env);
  return json({ settings, schema: getSettingsSchema() });
}

export async function onRequestPut(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return auth.error;

  const contentType = context.request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return badRequest('Invalid JSON body');

  let body;
  try {
    body = await context.request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return badRequest('Invalid settings payload');
  }

  try {
    const settings = await updateSiteSettings(context.env, body);
    return json({ ok: true, settings });
  } catch (error) {
    return badRequest(String(error?.message || 'Update settings failed'));
  }
}
