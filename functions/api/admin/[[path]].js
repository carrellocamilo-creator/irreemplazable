// API privada del mentor. Todo pasa por la verificación de Cloudflare Access.

import { json, error, readJson, HttpError, newId, newToken, nowIso, todayAR } from '../../../src/http.js';
import { verifyAccess } from '../../../src/auth.js';

// ---------- Validación ----------

const ESTADOS = ['aplicacion', 'diagnostico', 'activo', 'pausado', 'cerrado', 'sosten90'];
const MOMENTOS_ARCON = ['sesion0', 'fin_f1', 'fin_f2', 'fin_f3', 'fin_f4', 'fin_f5', 'fin_f6', 'final', 'sosten30', 'sosten60', 'sosten90'];
const TIPOS_ACTO = ['no', 'limite', 'pedido', 'conversacion', 'decision'];
const TIPOS_FORM_ACTIVOS = ['ingreso']; // Etapa 2 suma diagnóstico, bitácora y cierre.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/;

const v = {
  text: (max = 5000) => (x) => {
    if (x === undefined) return undefined;
    if (x === null) return null;
    const s = String(x).trim().slice(0, max);
    return s === '' ? null : s;
  },
  int: (min, max) => (x) => {
    if (x === undefined) return undefined;
    if (x === null || x === '') return null;
    const n = Number(x);
    if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(`Valor fuera de rango (${min}–${max}).`);
    return n;
  },
  oneOf: (list) => (x) => {
    if (x === undefined) return undefined;
    if (x === null || x === '') return null;
    if (!list.includes(x)) throw new HttpError('Opción no válida.');
    return x;
  },
  date: (x) => {
    if (x === undefined) return undefined;
    if (x === null || x === '') return null;
    if (!DATE_RE.test(x)) throw new HttpError('Fecha no válida.');
    return x;
  },
  datetime: (x) => {
    if (x === undefined) return undefined;
    if (x === null || x === '') return null;
    if (!DATETIME_RE.test(x)) throw new HttpError('Fecha no válida.');
    return x;
  },
  bool: (x) => (x === undefined ? undefined : x ? 1 : 0),
};

function pick(body, schema) {
  const out = {};
  for (const [key, fn] of Object.entries(schema)) {
    const val = fn(body[key]);
    if (val !== undefined) out[key] = val;
  }
  return out;
}

const CONSULTANT_FIELDS = {
  nombre: v.text(200),
  email: v.text(200),
  whatsapp: v.text(60),
  edad: v.int(18, 99),
  ciudad_pais: v.text(200),
  rol: v.text(200),
  fecha_ingreso: v.date,
  estado: v.oneOf(ESTADOS),
  fase_actual: v.int(0, 6),
  fase_inicio: v.date,
  proxima_sesion: v.datetime,
  registro: v.oneOf(['claro', 'profundo']),
  alerta_cuidado: v.bool,
  notas_generales: v.text(20000),
};

const SESSION_FIELDS = {
  fecha: v.date,
  numero: v.int(0, 500),
  fase: v.int(0, 6),
  semaforo: v.oneOf(['verde', 'amarillo', 'rojo']),
  como_llega: v.text(),
  tecnica_usada: v.text(1000),
  intensidad: v.oneOf(['baja', 'media', 'alta']),
  notas_mentor: v.text(20000),
  lo_que_se_lleva: v.text(),
  compromiso_semana: v.text(),
  cumplio_compromiso_anterior: v.oneOf(['si', 'parcial', 'no']),
};

const ARCON_FIELDS = {
  momento: v.oneOf(MOMENTOS_ARCON),
  quien: v.oneOf(['consultante', 'mentor']),
  autenticidad: v.int(1, 5),
  resonancia: v.int(1, 5),
  coherencia: v.int(1, 5),
  observacion: v.int(1, 5),
  narrativa: v.int(1, 5),
  fecha: v.date,
};

const INDICATOR_FIELDS = {
  fecha: v.date,
  sueno: v.int(1, 10),
  energia: v.int(1, 10),
  intensidad_sintoma: v.int(1, 10),
  vida_propia: v.int(1, 10),
  sintoma_descripcion: v.text(),
};

const ACT_FIELDS = {
  fecha: v.date,
  fase: v.int(0, 6),
  descripcion: v.text(5000),
  tipo: v.oneOf(TIPOS_ACTO),
};

// ---------- Helpers de base ----------

function insert(db, table, row) {
  const cols = Object.keys(row);
  return db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .bind(...cols.map((c) => row[c]));
}

function update(db, table, id, row) {
  const cols = Object.keys(row);
  return db.prepare(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`)
    .bind(...cols.map((c) => row[c]), id);
}

async function all(db, sql, ...args) {
  const r = await db.prepare(sql).bind(...args).all();
  return r.results || [];
}

async function requireConsultant(db, id) {
  const c = await db.prepare('SELECT * FROM consultants WHERE id = ?').bind(id).first();
  if (!c) throw new HttpError('No existe esa consultante.', 404);
  return c;
}

function formLink(origin, form) {
  const path = form.tipo === 'ingreso' ? 'ingreso' : form.tipo;
  return `${origin}/f/${path}?t=${form.token}`;
}

const CHILD_TABLES = ['forms', 'arcon', 'indicators', 'sessions', 'identity_acts', 'witness', 'checkins', 'ai_analyses'];

async function fullRecord(db, id) {
  const consultant = await requireConsultant(db, id);
  const [forms, sessions, arcon, indicators, acts, witness, checkins, analyses] = await Promise.all([
    all(db, 'SELECT * FROM forms WHERE consultant_id = ? ORDER BY COALESCE(respondido_at, enviado_at) DESC', id),
    all(db, 'SELECT * FROM sessions WHERE consultant_id = ? ORDER BY fecha DESC, numero DESC', id),
    all(db, 'SELECT * FROM arcon WHERE consultant_id = ? ORDER BY fecha', id),
    all(db, 'SELECT * FROM indicators WHERE consultant_id = ? ORDER BY fecha', id),
    all(db, 'SELECT * FROM identity_acts WHERE consultant_id = ? ORDER BY fecha DESC', id),
    all(db, 'SELECT * FROM witness WHERE consultant_id = ?', id),
    all(db, 'SELECT * FROM checkins WHERE consultant_id = ? ORDER BY fecha DESC', id),
    all(db, 'SELECT * FROM ai_analyses WHERE consultant_id = ? ORDER BY fecha DESC', id),
  ]);
  return { consultant, forms, sessions, arcon, indicators, identity_acts: acts, witness, checkins, ai_analyses: analyses };
}

// ---------- Rutas ----------

const routes = [];
function route(method, pattern, handler) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler });
}

route('GET', '/me', async ({ email }) => json({ email }));

route('GET', '/dashboard', async ({ db, origin }) => {
  const consultants = await all(db, `
    SELECT c.id, c.nombre, c.estado, c.fase_actual, c.fase_inicio, c.proxima_sesion, c.alerta_cuidado,
           c.registro, c.fecha_ingreso, c.whatsapp,
           (SELECT s.semaforo FROM sessions s WHERE s.consultant_id = c.id ORDER BY s.fecha DESC, s.numero DESC LIMIT 1) AS ultimo_semaforo,
           (SELECT s.fecha FROM sessions s WHERE s.consultant_id = c.id ORDER BY s.fecha DESC, s.numero DESC LIMIT 1) AS ultima_sesion
    FROM consultants c
    ORDER BY c.nombre COLLATE NOCASE`);
  const pending = await all(db, `
    SELECT f.id, f.tipo, f.token, f.enviado_at, c.id AS consultant_id, c.nombre
    FROM forms f JOIN consultants c ON c.id = f.consultant_id
    WHERE f.respondido_at IS NULL
    ORDER BY f.enviado_at DESC`);
  const recent = await all(db, `
    SELECT f.id, f.tipo, f.respondido_at, c.id AS consultant_id, c.nombre
    FROM forms f JOIN consultants c ON c.id = f.consultant_id
    WHERE f.respondido_at IS NOT NULL
    ORDER BY f.respondido_at DESC LIMIT 8`);
  return json({
    today: todayAR(),
    consultants,
    pending_forms: pending.map((f) => ({ ...f, link: formLink(origin, f), token: undefined })),
    recent_forms: recent,
  });
});

route('POST', '/consultants', async ({ db, body, origin }) => {
  const data = pick(body, CONSULTANT_FIELDS);
  if (!data.nombre) throw new HttpError('El nombre es obligatorio.');
  const id = newId();
  const now = nowIso();
  const form = { id: newId(), consultant_id: id, tipo: 'ingreso', token: newToken(), enviado_at: now };
  await db.batch([
    insert(db, 'consultants', { estado: 'aplicacion', ...data, id, created_at: now, updated_at: now }),
    insert(db, 'forms', form),
  ]);
  return json({ id, ingreso_link: formLink(origin, form) }, 201);
});

route('GET', '/consultants/:id', async ({ db, params, origin }) => {
  const rec = await fullRecord(db, params.id);
  rec.forms = rec.forms.map((f) => ({ ...f, link: f.respondido_at ? null : formLink(origin, f), token: undefined }));
  rec.witness = rec.witness.map((w) => ({ ...w, token: undefined }));
  return json(rec);
});

route('PATCH', '/consultants/:id', async ({ db, params, body }) => {
  const current = await requireConsultant(db, params.id);
  const data = pick(body, CONSULTANT_FIELDS);
  if ('nombre' in data && !data.nombre) throw new HttpError('El nombre es obligatorio.');
  if ('fase_actual' in data && data.fase_actual !== current.fase_actual && !('fase_inicio' in data)) {
    data.fase_inicio = todayAR();
  }
  if (!Object.keys(data).length) return json({ ok: true });
  data.updated_at = nowIso();
  await update(db, 'consultants', params.id, data).run();
  return json({ ok: true });
});

route('DELETE', '/consultants/:id', async ({ db, params }) => {
  await requireConsultant(db, params.id);
  await db.batch([
    ...CHILD_TABLES.map((t) => db.prepare(`DELETE FROM ${t} WHERE consultant_id = ?`).bind(params.id)),
    db.prepare('DELETE FROM consultants WHERE id = ?').bind(params.id),
  ]);
  return json({ ok: true });
});

route('GET', '/consultants/:id/export', async ({ db, params }) => {
  const rec = await fullRecord(db, params.id);
  rec.forms = rec.forms.map((f) => ({ ...f, token: undefined, respuestas_json: safeParse(f.respuestas_json) }));
  rec.witness = rec.witness.map((w) => ({ ...w, token: undefined }));
  const name = (rec.consultant.nombre || 'consultante').normalize('NFD').replace(/[^\w ]/g, '').trim().replace(/\s+/g, '-').toLowerCase();
  return json({ exportado: nowIso(), ...rec }, 200, {
    'Content-Disposition': `attachment; filename="irreemplazable-${name}-${todayAR()}.json"`,
  });
});

route('POST', '/consultants/:id/forms', async ({ db, params, body, origin }) => {
  await requireConsultant(db, params.id);
  const tipo = body.tipo || 'ingreso';
  if (!TIPOS_FORM_ACTIVOS.includes(tipo)) throw new HttpError('Ese formulario llega en la Etapa 2.');
  const existing = await db.prepare(
    'SELECT * FROM forms WHERE consultant_id = ? AND tipo = ? AND respondido_at IS NULL',
  ).bind(params.id, tipo).first();
  if (existing) return json({ id: existing.id, link: formLink(origin, existing) });
  const form = { id: newId(), consultant_id: params.id, tipo, token: newToken(), enviado_at: nowIso() };
  await insert(db, 'forms', form).run();
  return json({ id: form.id, link: formLink(origin, form) }, 201);
});

route('DELETE', '/forms/:id', async ({ db, params }) => {
  const r = await db.prepare('DELETE FROM forms WHERE id = ? AND respondido_at IS NULL').bind(params.id).run();
  if (!r.meta.changes) throw new HttpError('Solo se pueden anular links que no fueron respondidos.', 409);
  return json({ ok: true });
});

// Sesiones
route('GET', '/sessions/:id', async ({ db, params }) => {
  const s = await db.prepare('SELECT * FROM sessions WHERE id = ?').bind(params.id).first();
  if (!s) throw new HttpError('No existe esa sesión.', 404);
  return json(s);
});

route('POST', '/consultants/:id/sessions', async ({ db, params, body }) => {
  const c = await requireConsultant(db, params.id);
  const data = pick(body, SESSION_FIELDS);
  if (!data.fecha) data.fecha = todayAR();
  if (data.numero == null) {
    const r = await db.prepare('SELECT COALESCE(MAX(numero), 0) + 1 AS n FROM sessions WHERE consultant_id = ?').bind(c.id).first();
    data.numero = r.n;
  }
  if (data.fase == null) data.fase = c.fase_actual;
  const id = newId();
  await insert(db, 'sessions', { ...data, id, consultant_id: c.id }).run();
  return json({ id }, 201);
});

route('PUT', '/sessions/:id', async ({ db, params, body }) => {
  const data = pick(body, SESSION_FIELDS);
  if ('fecha' in data && !data.fecha) throw new HttpError('La fecha es obligatoria.');
  if (!Object.keys(data).length) return json({ ok: true });
  const r = await update(db, 'sessions', params.id, data).run();
  if (!r.meta.changes) throw new HttpError('No existe esa sesión.', 404);
  return json({ ok: true });
});

route('DELETE', '/sessions/:id', async ({ db, params }) => {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(params.id).run();
  return json({ ok: true });
});

// ARCON (una medición por momento y por quién; volver a cargar la reemplaza)
route('POST', '/consultants/:id/arcon', async ({ db, params, body }) => {
  await requireConsultant(db, params.id);
  const d = pick(body, ARCON_FIELDS);
  if (!d.momento || !d.quien) throw new HttpError('Elige el momento y quién mide.');
  const dims = ['autenticidad', 'resonancia', 'coherencia', 'observacion', 'narrativa'];
  if (dims.some((k) => d[k] == null)) throw new HttpError('Completa las cinco dimensiones.');
  d.fecha = d.fecha || todayAR();
  await db.prepare(`
    INSERT INTO arcon (id, consultant_id, momento, quien, autenticidad, resonancia, coherencia, observacion, narrativa, fecha)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (consultant_id, momento, quien) DO UPDATE SET
      autenticidad = excluded.autenticidad, resonancia = excluded.resonancia, coherencia = excluded.coherencia,
      observacion = excluded.observacion, narrativa = excluded.narrativa, fecha = excluded.fecha`)
    .bind(newId(), params.id, d.momento, d.quien, d.autenticidad, d.resonancia, d.coherencia, d.observacion, d.narrativa, d.fecha)
    .run();
  return json({ ok: true }, 201);
});

route('DELETE', '/arcon/:id', async ({ db, params }) => {
  await db.prepare('DELETE FROM arcon WHERE id = ?').bind(params.id).run();
  return json({ ok: true });
});

// Indicadores 1–10
route('POST', '/consultants/:id/indicators', async ({ db, params, body }) => {
  await requireConsultant(db, params.id);
  const d = pick(body, INDICATOR_FIELDS);
  d.fecha = d.fecha || todayAR();
  if (['sueno', 'energia', 'intensidad_sintoma', 'vida_propia'].every((k) => d[k] == null)) {
    throw new HttpError('Carga al menos un indicador.');
  }
  await insert(db, 'indicators', { ...d, id: newId(), consultant_id: params.id }).run();
  return json({ ok: true }, 201);
});

route('DELETE', '/indicators/:id', async ({ db, params }) => {
  await db.prepare('DELETE FROM indicators WHERE id = ?').bind(params.id).run();
  return json({ ok: true });
});

// Actos de identidad
route('POST', '/consultants/:id/acts', async ({ db, params, body }) => {
  const c = await requireConsultant(db, params.id);
  const d = pick(body, ACT_FIELDS);
  if (!d.descripcion) throw new HttpError('Describe el acto de identidad.');
  d.fecha = d.fecha || todayAR();
  if (d.fase == null) d.fase = c.fase_actual;
  await insert(db, 'identity_acts', { ...d, id: newId(), consultant_id: c.id }).run();
  return json({ ok: true }, 201);
});

route('DELETE', '/acts/:id', async ({ db, params }) => {
  await db.prepare('DELETE FROM identity_acts WHERE id = ?').bind(params.id).run();
  return json({ ok: true });
});

// Respaldo completo de la base
route('GET', '/backup', async ({ db }) => {
  const tables = ['consultants', ...CHILD_TABLES];
  const out = { exportado: nowIso() };
  for (const t of tables) out[t] = await all(db, `SELECT * FROM ${t}`);
  return json(out, 200, { 'Content-Disposition': `attachment; filename="irreemplazable-respaldo-${todayAR()}.json"` });
});

function safeParse(s) {
  try { return JSON.parse(s); } catch { return s; }
}

// ---------- Entrada ----------

export async function onRequest(context) {
  const { request, env } = context;
  try {
    const email = await verifyAccess(request, env);
    if (!email) return error('Acceso no autorizado.', 401);
    if (!env.DB) return error('La base de datos no está conectada (falta el binding DB).', 500);

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\/admin/, '').replace(/\/$/, '') || '/';
    const method = request.method;

    if (method !== 'GET') {
      // Bloquea pedidos que no vengan del propio panel.
      const o = request.headers.get('Origin');
      if (o && o !== url.origin) return error('Origen no permitido.', 403);
    }

    for (const r of routes) {
      if (r.method !== method) continue;
      const m = path.match(r.re);
      if (!m) continue;
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      const body = ['POST', 'PUT', 'PATCH'].includes(method) ? await readJson(request) : {};
      return await r.handler({ db: env.DB, params, body, email, origin: url.origin, env });
    }
    return error('Ruta no encontrada.', 404);
  } catch (e) {
    if (e instanceof HttpError) return error(e.message, e.status);
    console.error(e);
    return error('Error interno. Revisa los registros en Cloudflare.', 500);
  }
}
