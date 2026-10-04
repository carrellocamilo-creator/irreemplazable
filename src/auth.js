// Verificación de Cloudflare Access en el servidor.
// Access ya bloquea el panel antes de llegar acá; esta segunda capa evita que
// la API quede abierta si alguna URL (por ejemplo, una vista previa de rama)
// no está cubierta por Access. Si falta configuración, se niega el acceso.

import { b64urlToBytes } from './http.js';

let certCache = { at: 0, keys: null, team: null };

async function getCerts(team) {
  const fresh = Date.now() - certCache.at < 60 * 60 * 1000;
  if (certCache.keys && certCache.team === team && fresh) return certCache.keys;
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error('No se pudieron obtener los certificados de Access.');
  const body = await res.json();
  certCache = { at: Date.now(), keys: body.keys || [], team };
  return certCache.keys;
}

function decodePart(part) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(part)));
}

function normalizeTeam(value) {
  return String(value || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

// Devuelve el email autenticado o null.
export async function verifyAccess(request, env) {
  const url = new URL(request.url);

  // Solo para pruebas en la computadora local (nunca se cumple en Cloudflare).
  if (env.LOCAL_DEV === '1' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
    return env.MENTOR_EMAIL || 'local@dev';
  }

  const team = normalizeTeam(env.ACCESS_TEAM_DOMAIN);
  const aud = String(env.ACCESS_AUD || '').trim();
  const mentor = String(env.MENTOR_EMAIL || '').trim().toLowerCase();
  if (!team || !aud || !mentor) return null;

  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  let header, payload;
  try {
    header = decodePart(parts[0]);
    payload = decodePart(parts[1]);
  } catch {
    return null;
  }
  if (header.alg !== 'RS256') return null;

  const audList = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audList.includes(aud)) return null;
  if (payload.iss !== `https://${team}`) return null;
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) return null;

  const keys = await getCerts(team);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) return null;

  const key = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'],
  );
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!ok) return null;

  const email = String(payload.email || '').toLowerCase();
  return email === mentor ? email : null;
}
