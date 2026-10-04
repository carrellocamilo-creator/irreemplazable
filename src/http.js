// Utilidades HTTP compartidas por las Functions.

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...BASE_HEADERS, ...extra } });
}

export function error(message, status = 400) {
  return json({ error: message }, status);
}

const MAX_BODY = 200_000;

export async function readJson(request) {
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > MAX_BODY) throw new HttpError('El contenido es demasiado grande.', 413);
  const text = await request.text();
  if (text.length > MAX_BODY) throw new HttpError('El contenido es demasiado grande.', 413);
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new HttpError('Formato inválido.', 400);
  }
}

export class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function newId() {
  return crypto.randomUUID();
}

// Token de 32 bytes aleatorios en base64url: imposible de adivinar.
export function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return b64url(bytes);
}

export function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlToBytes(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function nowIso() {
  return new Date().toISOString();
}

// Fecha local de Argentina en formato AAAA-MM-DD.
export function todayAR() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
}
