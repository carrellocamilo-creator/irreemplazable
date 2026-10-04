// Formularios públicos para consultantes (link con token único).
// Un token solo permite saber si el formulario está pendiente y enviarlo una vez.
// Nunca devuelve datos guardados.

import { json, error, readJson, HttpError, newId, nowIso, todayAR } from '../../../src/http.js';
import { notifyMentor } from '../../../src/email.js';

const TOKEN_RE = /^[A-Za-z0-9_-]{30,60}$/;

async function findForm(env, token) {
  if (!TOKEN_RE.test(token)) return null;
  return env.DB.prepare('SELECT id, consultant_id, tipo, respondido_at FROM forms WHERE token = ?')
    .bind(token).first();
}

export async function onRequestGet({ params, env }) {
  const form = await findForm(env, params.token);
  if (!form) return error('Este enlace no es válido.', 404);
  return json({ tipo: form.tipo, estado: form.respondido_at ? 'respondido' : 'pendiente' });
}

export async function onRequestPost(context) {
  const { params, env, request } = context;
  try {
    const form = await findForm(env, params.token);
    if (!form) return error('Este enlace no es válido.', 404);
    if (form.respondido_at) return error('Este formulario ya fue enviado.', 409);

    const body = await readJson(request);
    if (form.tipo === 'ingreso') return await submitIngreso(context, form, body);
    return error('Este formulario todavía no está disponible.', 400);
  } catch (e) {
    if (e instanceof HttpError) return error(e.message, e.status);
    console.error(e);
    return error('No se pudo guardar. Intenta de nuevo.', 500);
  }
}

// ---------- Ingreso ----------

function str(v, max = 5000) {
  if (v === undefined || v === null) return '';
  return String(v).trim().slice(0, max);
}
function int(v, min, max) {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}
function yes(v) {
  return v === 'Sí' || v === 'Si' || v === true;
}

function cleanLabeled(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj).slice(0, 120)) {
    out[str(k, 200)] = str(v, 8000);
  }
  return out;
}

async function submitIngreso(context, form, body) {
  const { env, request } = context;
  const f = body.fields || {};

  const data = {
    nombre: str(f.nombre, 200),
    email: str(f.email, 200),
    whatsapp: str(f.tel, 60),
    edad: int(f.edad, 18, 99),
    ciudad_pais: str(f.ciudad, 200),
    rol: str(f.rol, 200),
    sueno: int(f.ind_sueno, 1, 10),
    energia: int(f.ind_energia, 1, 10),
    sintoma: int(f.ind_sintoma, 1, 10),
    vida_propia: int(f.ind_propia, 1, 10),
    sintoma_descripcion: str(f.p9),
    a: int(f.arcon_a, 1, 5),
    r: int(f.arcon_r, 1, 5),
    c: int(f.arcon_c, 1, 5),
    o: int(f.arcon_o, 1, 5),
    n: int(f.arcon_n, 1, 5),
    crisis: yes(f.s_crisis),
  };

  const missing =
    !data.nombre || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || !data.whatsapp ||
    !str(f.p1) || !str(f.p2) || !str(f.p24) || !str(f.firma) ||
    data.sueno === null || data.energia === null || data.vida_propia === null ||
    [data.a, data.r, data.c, data.o, data.n].some((x) => x === null) ||
    !['s_trat', 's_med', 's_fis', 's_crisis'].every((k) => ['Sí', 'No'].includes(f[k])) ||
    !(f.c1 && f.c2 && f.c3);
  if (missing) throw new HttpError('Faltan respuestas obligatorias.', 400);

  const now = nowIso();
  const today = todayAR();

  // Marca el formulario como respondido solo si seguía pendiente (evita envíos dobles).
  const claim = await env.DB.prepare(
    'UPDATE forms SET respondido_at = ? WHERE id = ? AND respondido_at IS NULL',
  ).bind(now, form.id).run();
  if (!claim.meta || claim.meta.changes !== 1) throw new HttpError('Este formulario ya fue enviado.', 409);

  const respuestas = {
    version: 1,
    campos: Object.fromEntries(Object.entries(f).slice(0, 120).map(([k, v]) => [str(k, 60), typeof v === 'boolean' ? v : str(v, 8000)])),
    etiquetas: cleanLabeled(body.labeled),
  };

  const cid = form.consultant_id;
  try {
    await env.DB.batch([
      env.DB.prepare('UPDATE forms SET respuestas_json = ? WHERE id = ?').bind(JSON.stringify(respuestas), form.id),
      env.DB.prepare(
        `UPDATE consultants SET nombre = ?, email = ?, whatsapp = ?, edad = ?, ciudad_pais = ?, rol = ?,
           fecha_ingreso = COALESCE(fecha_ingreso, ?),
           alerta_cuidado = CASE WHEN ? = 1 THEN 1 ELSE alerta_cuidado END,
           updated_at = ?
         WHERE id = ?`,
      ).bind(data.nombre, data.email, data.whatsapp, data.edad, data.ciudad_pais || null, data.rol || null,
        today, data.crisis ? 1 : 0, now, cid),
      env.DB.prepare(
        `INSERT INTO arcon (id, consultant_id, momento, quien, autenticidad, resonancia, coherencia, observacion, narrativa, fecha)
         VALUES (?, ?, 'sesion0', 'consultante', ?, ?, ?, ?, ?, ?)
         ON CONFLICT (consultant_id, momento, quien) DO UPDATE SET
           autenticidad = excluded.autenticidad, resonancia = excluded.resonancia, coherencia = excluded.coherencia,
           observacion = excluded.observacion, narrativa = excluded.narrativa, fecha = excluded.fecha`,
      ).bind(newId(), cid, data.a, data.r, data.c, data.o, data.n, today),
      env.DB.prepare(
        `INSERT INTO indicators (id, consultant_id, fecha, sueno, energia, intensidad_sintoma, vida_propia, sintoma_descripcion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(newId(), cid, today, data.sueno, data.energia, data.sintoma, data.vida_propia, data.sintoma_descripcion || null),
    ]);
  } catch (e) {
    // Si algo falla, el link vuelve a quedar disponible.
    await env.DB.prepare('UPDATE forms SET respondido_at = NULL WHERE id = ?').bind(form.id).run();
    throw e;
  }

  const origin = new URL(request.url).origin;
  context.waitUntil(notifyMentor(env, {
    subject: `Nuevo ingreso: ${data.nombre}${data.crisis ? ' · Revisar cuidado' : ''}`,
    care: data.crisis
      ? 'Respondió "Sí" en la pregunta de crisis o pensamientos de hacerse daño. Escríbele antes de la sesión.'
      : null,
    lines: [`${data.nombre} completó el formulario de ingreso.`],
    link: `${origin}/panel/consultante?id=${encodeURIComponent(cid)}`,
  }));

  return json({ ok: true });
}
