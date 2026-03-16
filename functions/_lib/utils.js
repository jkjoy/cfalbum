export async function getJson(request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function toInt(value, fallback = 0) {
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function safeArrayJson(input, fallback = []) {
  try {
    const parsed = JSON.parse(input || '[]');
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function escapeHtml(input) {
  return String(input || '').replace(/[&<>"']/g, (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}

export function photoUrl(env, key) {
  if (!key) return '/src/noimage.svg';
  const base = env.R2_PUBLIC_BASE_URL || '';
  if (base) return `${base.replace(/\/$/, '')}/${key}`;
  return `/api/object/${encodeURIComponent(key)}`;
}
