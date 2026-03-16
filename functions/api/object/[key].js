import { notFound } from '../../_lib/response.js';

export async function onRequestGet(context) {
  const { params, env } = context;
  const key = decodeURIComponent(params.key || '');
  if (!key) return notFound('Object not found');

  const object = await env.BUCKET.get(key);
  if (!object) return notFound('Object not found');

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
}
