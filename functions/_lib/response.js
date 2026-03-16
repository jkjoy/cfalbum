export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has('content-type')) headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function html(content, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has('content-type')) headers.set('content-type', 'text/html; charset=utf-8');
  return new Response(content, { ...init, headers });
}

export function notFound(message = 'Not Found', init = {}) {
  return json({ error: message }, { ...init, status: 404 });
}

export function unauthorized(message = 'Unauthorized', init = {}) {
  return json({ error: message }, { ...init, status: 401 });
}

export function badRequest(message = 'Bad Request', init = {}) {
  return json({ error: message }, { ...init, status: 400 });
}
