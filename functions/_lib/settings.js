import { cacheDeleteMany, cacheGet, cachePut, SITE_SETTINGS_CACHE_KEY, homePageCacheKey } from './cache.js';

const ARRAY_ENUMS = {
  coverRadius: ['cr_tl', 'cr_tr', 'cr_br', 'cr_bl'],
  coverTitleBorder: ['ctb_t', 'ctb_r', 'ctb_b', 'ctb_l'],
  coverTitleRadius: ['ctr_tl', 'ctr_tr', 'ctr_br', 'ctr_bl'],
  fancyBox3Opt: ['fb3_zoom', 'fb3_share', 'fb3_slideShow', 'fb3_fullScreen', 'fb3_download', 'fb3_thumbs', 'fb3_close']
};

const SCHEMA = {
  siteTitle: { type: 'string', default: 'Photograph', max: 120, env: 'SITE_TITLE' },
  logo: { type: 'string', default: '' },
  favicon: { type: 'string', default: '' },
  description: { type: 'string', default: '', max: 400 },
  navStyle: { type: 'enum', values: ['ins', 'boot'], default: 'ins' },
  pageSize: { type: 'int', default: 24, min: 1, max: 60 },
  colXs: { type: 'int', default: 12, min: 1, max: 12 },
  colSm: { type: 'int', default: 6, min: 1, max: 12 },
  colMd: { type: 'int', default: 4, min: 1, max: 12 },
  colLg: { type: 'int', default: 3, min: 1, max: 12 },
  coverHeightTimes: { type: 'number', default: 1, min: 0.2, max: 4 },
  imgHeightTimes: { type: 'number', default: 1, min: 0.2, max: 4 },
  coverTitle: { type: 'number', default: 1, min: 0, max: 1 },
  coverRadius: { type: 'arrayEnum', values: ARRAY_ENUMS.coverRadius, default: ARRAY_ENUMS.coverRadius },
  coverTitleBorder: { type: 'arrayEnum', values: ARRAY_ENUMS.coverTitleBorder, default: ARRAY_ENUMS.coverTitleBorder },
  coverTitleRadius: { type: 'arrayEnum', values: ARRAY_ENUMS.coverTitleRadius, default: ARRAY_ENUMS.coverTitleRadius },
  coverOrn: { type: 'enum', values: ['co_none', 'co_cat'], default: 'co_none' },
  sideButton: { type: 'int', default: 3, min: 1, max: 4 },
  notice: { type: 'string', default: '' },
  noticeStyle: { type: 'enum', values: ['top', 'bottom'], default: 'bottom' },
  noticeColor: { type: 'string', default: '' },
  diyCss: { type: 'string', default: '' },
  infiniteScroll: { type: 'boolean', default: false },
  fancyBox3Opt: { type: 'arrayEnum', values: ARRAY_ENUMS.fancyBox3Opt, default: ['fb3_download', 'fb3_thumbs', 'fb3_close'] },
  lazyImg: { type: 'string', default: '' },
  mobileCate: { type: 'boolean', default: false },
  randomPostPt: { type: 'int', default: 0, min: 0, max: 1 },
  enableQrcode: { type: 'boolean', default: true },
  hotKeys: { type: 'boolean', default: false }
};

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeValue(key, value) {
  const schema = SCHEMA[key];
  if (!schema) throw new Error(`Unsupported setting key: ${key}`);

  switch (schema.type) {
    case 'string': {
      const str = String(value ?? '').trim();
      if (schema.max && str.length > schema.max) return str.slice(0, schema.max);
      return str;
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      const raw = String(value).trim().toLowerCase();
      if (raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on') return true;
      if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off' || raw === '') return false;
      throw new Error(`Invalid boolean for ${key}`);
    }
    case 'int': {
      const n = Number.parseInt(String(value), 10);
      if (!Number.isFinite(n)) throw new Error(`Invalid integer for ${key}`);
      return clampNumber(n, schema.min, schema.max);
    }
    case 'number': {
      const n = Number.parseFloat(String(value));
      if (!Number.isFinite(n)) throw new Error(`Invalid number for ${key}`);
      return clampNumber(n, schema.min, schema.max);
    }
    case 'enum': {
      const v = String(value);
      if (!schema.values.includes(v)) throw new Error(`Invalid value for ${key}`);
      return v;
    }
    case 'arrayEnum': {
      const arr = Array.isArray(value) ? value : [];
      const filtered = arr
        .map((x) => String(x).trim())
        .filter((x) => schema.values.includes(x));
      return Array.from(new Set(filtered));
    }
    default:
      return schema.default;
  }
}

function normalizeFromRaw(key, value) {
  const schema = SCHEMA[key];
  if (!schema) return undefined;
  try {
    return normalizeValue(key, value);
  } catch {
    return Array.isArray(schema.default) ? [...schema.default] : schema.default;
  }
}

function buildDefaultSettings(env) {
  const out = {};
  for (const [key, schema] of Object.entries(SCHEMA)) {
    let value = Array.isArray(schema.default) ? [...schema.default] : schema.default;
    if (schema.env && env?.[schema.env]) {
      value = normalizeFromRaw(key, env[schema.env]);
    }
    out[key] = value;
  }
  return out;
}

export function getSettingsSchema() {
  return SCHEMA;
}

export async function getSiteSettings(env) {
  const cached = await cacheGet(env, SITE_SETTINGS_CACHE_KEY);
  if (cached) return cached;

  const defaults = buildDefaultSettings(env);
  const rows = await env.DB.prepare('SELECT key, value_json FROM site_settings').all();
  const settings = { ...defaults };

  for (const row of rows.results || []) {
    if (!SCHEMA[row.key]) continue;
    try {
      const parsed = JSON.parse(row.value_json);
      settings[row.key] = normalizeFromRaw(row.key, parsed);
    } catch {
      settings[row.key] = defaults[row.key];
    }
  }

  await cachePut(env, SITE_SETTINGS_CACHE_KEY, settings, 300);
  return settings;
}

export async function getHomepageInvalidationKeys(env) {
  const settings = await getSiteSettings(env);
  return Array.from(new Set([
    homePageCacheKey(1, 24),
    homePageCacheKey(1, settings.pageSize)
  ]));
}

export async function updateSiteSettings(env, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error('Invalid settings payload');
  }

  const keys = Object.keys(patch);
  if (!keys.length) throw new Error('No settings provided');

  const current = await getSiteSettings(env);
  const updates = [];

  for (const key of keys) {
    if (!SCHEMA[key]) throw new Error(`Unsupported setting key: ${key}`);
    const normalized = normalizeValue(key, patch[key]);
    updates.push({ key, value: normalized });
  }

  for (const item of updates) {
    await env.DB.prepare(`
      INSERT INTO site_settings (key, value_json, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = datetime('now')
    `).bind(item.key, JSON.stringify(item.value)).run();
  }

  const next = { ...current };
  for (const item of updates) next[item.key] = item.value;

  const keysToDelete = Array.from(new Set([
    SITE_SETTINGS_CACHE_KEY,
    homePageCacheKey(1, current.pageSize),
    homePageCacheKey(1, next.pageSize),
    homePageCacheKey(1, 24)
  ]));
  await cacheDeleteMany(env, keysToDelete);

  return next;
}
