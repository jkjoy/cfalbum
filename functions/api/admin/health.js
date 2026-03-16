import { json } from '../../_lib/response.js';

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const tableRow = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'admins' LIMIT 1").first();
    const countRow = await env.DB.prepare('SELECT COUNT(*) AS count FROM admins').first();

    return json({
      ok: true,
      hasAdminsTable: Boolean(tableRow),
      adminCount: Number.parseInt(String(countRow?.count ?? 0), 10) || 0
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: 'Health check failed',
        details: String(error?.message || error)
      },
      { status: 500 }
    );
  }
}
