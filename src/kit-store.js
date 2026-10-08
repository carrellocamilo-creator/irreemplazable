// Lógica de los kits de fase: guardar respuestas (primera y final), mediciones,
// testigo propuesto, acto de identidad en borrador, cuidado y entrega.

import { HttpError, newId, nowIso, todayAR } from './http.js';
import { getKit, resolveVars, fieldsOf } from './kits/index.js';
import { notifyMentor } from './email.js';

export const TOKEN_RE = /^[A-Za-z0-9_-]{30,60}$/;

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const ZONAS = {
  'Asia/Shanghai': 'hora China',
  'America/Argentina/Buenos_Aires': 'hora de Argentina',
  'America/Guayaquil': 'hora de Ecuador',
  'Europe/Madrid': 'hora de España',
  'Europe/Zurich': 'hora de Suiza',
  'America/Mexico_City': 'hora de México',
  'America/Bogota': 'hora de Colombia',
  'America/Santiago': 'hora de Chile',
  'America/Montevideo': 'hora de Uruguay',
};

// "El sábado 10 de octubre antes de las 20:00 hora China". La fecha ya está en la hora
// local de la consultante, así que no se convierte.
export function deadlineText(kit, config = {}) {
  const vars = resolveVars(kit, config);
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(config.deadline || '');
  if (!m) return vars.entrega_texto || '';
  const [, y, mo, d, hh, mm] = m.map(Number);
  const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  const zona = ZONAS[config.tz] || '';
  return `El ${DIAS[dow]} ${d} de ${MESES[mo - 1]} antes de las ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}${zona ? ` ${zona}` : ''}`;
}

// Reemplaza {{variable}} en todos los textos del kit.
export function personalize(kit, config = {}) {
  const vars = resolveVars(kit, config);
  const sub = (v) => {
    if (typeof v === 'string') return v.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
    if (Array.isArray(v)) return v.map(sub);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sub(x)]));
    return v;
  };
  const { vars: _omit, measurements: _m, witness: _w, act: _a, ...rest } = kit;
  const out = sub(rest);
  out.intro = vars.intro || '';
  out.deadline_text = deadlineText(kit, config);
  return out;
}

export async function findKitByToken(env, token) {
  if (!TOKEN_RE.test(token || '')) return null;
  return env.DB.prepare(
    `SELECT k.*, c.nombre AS consultant_nombre, c.fase_actual
     FROM kits k JOIN consultants c ON c.id = k.consultant_id WHERE k.token = ?`,
  ).bind(token).first();
}

export function parseConfig(row) {
  try { return JSON.parse(row.config_json || '{}'); } catch { return {}; }
}

export async function loadAnswers(env, kitId) {
  const r = await env.DB.prepare('SELECT * FROM kit_answers WHERE kit_id = ?').bind(kitId).all();
  return r.results || [];
}

export function currentValue(a) {
  return a.final_at ? (a.respuesta_final ?? '') : (a.primera_respuesta ?? '');
}

// ---------- Normalización ----------

function normalize(spec, raw) {
  if (raw === undefined || raw === null) return '';
  switch (spec.type) {
    case 'text': return String(raw).replace(/\s+$/, '').replace(/^\s+/, '').slice(0, 20000);
    case 'yesno': return ['Sí', 'No'].includes(raw) ? raw : '';
    case 'scale': {
      if (raw === '') return '';
      const n = Number(raw);
      return Number.isInteger(n) && n >= 1 && n <= spec.max ? String(n) : '';
    }
    case 'json': {
      let v = raw;
      if (typeof v === 'string') {
        if (v === '') return '';
        try { v = JSON.parse(v); } catch { return ''; }
      }
      if (!Array.isArray(v)) return '';
      const clean = v.slice(0, 60).map((x) => {
        if (typeof x === 'string') return x.slice(0, 80);
        if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).slice(0, 6).map(([k, s]) => [String(k).slice(0, 20), String(s ?? '').slice(0, 1000)]));
        return null;
      }).filter((x) => x !== null);
      const meaningful = clean.filter((x) => typeof x === 'string' || Object.values(x).some((s) => s.trim() !== ''));
      return meaningful.length ? JSON.stringify(meaningful) : '';
    }
    default: return '';
  }
}

// ---------- Guardado ----------

// values: { field_key: valor }. section: si viene, solo se aceptan campos de esa sección.
export async function saveValues(context, row, values, section) {
  const { env } = context;
  const kit = getKit(row.kit_key);
  if (!kit) throw new HttpError('Este trabajo no está disponible.', 404);
  if (row.entregado_at) throw new HttpError('Este trabajo ya fue entregado.', 409);
  const specs = fieldsOf(kit);
  if (section && !kit.sections.some((s) => s.key === section)) throw new HttpError('Sección no válida.');

  const existing = new Map((await loadAnswers(env, row.id)).map((a) => [a.field_key, a]));
  const now = nowIso();
  const stmts = [];
  const merged = Object.fromEntries([...existing.values()].map((a) => [a.field_key, currentValue(a)]));

  for (const [key, raw] of Object.entries(values || {})) {
    const spec = specs[key];
    if (!spec) continue;
    if (section && spec.section !== section) continue;
    const v = normalize(spec, raw);
    const prev = existing.get(key);
    merged[key] = v;
    if (!prev) {
      if (v === '') continue;
      stmts.push(env.DB.prepare(
        'INSERT INTO kit_answers (id, kit_id, field_key, primera_respuesta, primera_at) VALUES (?, ?, ?, ?, ?)',
      ).bind(newId(), row.id, key, v, now));
      continue;
    }
    if (v === currentValue(prev)) continue;
    if (v === (prev.primera_respuesta ?? '')) {
      stmts.push(env.DB.prepare('UPDATE kit_answers SET respuesta_final = NULL, final_at = NULL WHERE id = ?').bind(prev.id));
    } else {
      stmts.push(env.DB.prepare('UPDATE kit_answers SET respuesta_final = ?, final_at = ? WHERE id = ?').bind(v, now, prev.id));
    }
  }

  if (section) {
    stmts.push(env.DB.prepare('INSERT INTO kit_events (id, kit_id, tipo, section_key, at) VALUES (?, ?, ?, ?, ?)')
      .bind(newId(), row.id, 'guardado', section, now));
  }
  if (!row.started_at) {
    stmts.push(env.DB.prepare('UPDATE kits SET started_at = ? WHERE id = ? AND started_at IS NULL').bind(now, row.id));
  }
  if (stmts.length) await env.DB.batch(stmts);

  await applySideEffects(env, row, kit, merged, now);
  return { saved_at: now };
}

const filled = (v) => v !== undefined && v !== null && v !== '';

async function applySideEffects(env, row, kit, merged, now) {
  const today = todayAR();
  const fase = kit.fase ?? row.fase_actual ?? null;
  const stmts = [];

  // Mediciones de la consultante → ARCON e indicadores.
  const ms = kit.measurements || {};
  if (ms.arcon && Object.values(ms.arcon).some((k) => filled(merged[k]))) {
    const val = (dim) => (filled(merged[ms.arcon[dim]]) ? Number(merged[ms.arcon[dim]]) : null);
    stmts.push(env.DB.prepare(`
      INSERT INTO arcon (id, consultant_id, momento, quien, autenticidad, resonancia, coherencia, observacion, narrativa, fecha)
      VALUES (?, ?, ?, 'consultante', ?, ?, ?, ?, ?, ?)
      ON CONFLICT (consultant_id, momento, quien) DO UPDATE SET
        autenticidad = excluded.autenticidad, resonancia = excluded.resonancia, coherencia = excluded.coherencia,
        observacion = excluded.observacion, narrativa = excluded.narrativa, fecha = excluded.fecha`)
      .bind(newId(), row.consultant_id, ms.arcon_momento, val('autenticidad'), val('resonancia'), val('coherencia'),
        val('observacion'), val('narrativa'), today));
  }
  if (ms.indicators && Object.values(ms.indicators).some((k) => filled(merged[k]))) {
    const val = (col) => (filled(merged[ms.indicators[col]]) ? Number(merged[ms.indicators[col]]) : null);
    if (row.indicator_id) {
      stmts.push(env.DB.prepare(
        'UPDATE indicators SET fecha = ?, sueno = ?, energia = ?, intensidad_sintoma = ?, vida_propia = ? WHERE id = ?',
      ).bind(today, val('sueno'), val('energia'), val('intensidad_sintoma'), val('vida_propia'), row.indicator_id));
    } else {
      const indId = newId();
      row.indicator_id = indId;
      stmts.push(env.DB.prepare(
        `INSERT INTO indicators (id, consultant_id, fecha, sueno, energia, intensidad_sintoma, vida_propia, sintoma_descripcion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(indId, row.consultant_id, today, val('sueno'), val('energia'), val('intensidad_sintoma'), val('vida_propia'),
        `Kit ${kit.nombre_panel}`));
      stmts.push(env.DB.prepare('UPDATE kits SET indicator_id = ? WHERE id = ?').bind(indId, row.id));
    }
  }

  // Testigo propuesto, pendiente de confirmar.
  const w = kit.witness;
  if (w && (filled(merged[w.nombre]) || filled(merged[w.motivo]))) {
    const prev = await env.DB.prepare('SELECT id, estado FROM witness_proposals WHERE kit_id = ?').bind(row.id).first();
    if (!prev) {
      stmts.push(env.DB.prepare(
        `INSERT INTO witness_proposals (id, consultant_id, kit_id, nombre, motivo, estado, created_at)
         VALUES (?, ?, ?, ?, ?, 'pendiente', ?)`,
      ).bind(newId(), row.consultant_id, row.id, merged[w.nombre] || null, merged[w.motivo] || null, now));
    } else if (prev.estado === 'pendiente') {
      stmts.push(env.DB.prepare('UPDATE witness_proposals SET nombre = ?, motivo = ?, updated_at = ? WHERE id = ?')
        .bind(merged[w.nombre] || null, merged[w.motivo] || null, now, prev.id));
    }
  }

  // Acción real → acto de identidad en borrador.
  const a = kit.act;
  if (a && Object.values(a).some((k) => filled(merged[k]))) {
    const prev = await env.DB.prepare('SELECT id, estado FROM identity_act_drafts WHERE kit_id = ?').bind(row.id).first();
    if (!prev) {
      stmts.push(env.DB.prepare(
        `INSERT INTO identity_act_drafts (id, consultant_id, kit_id, fecha, fase, con_quien, que_dije, cuerpo, estado, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?)`,
      ).bind(newId(), row.consultant_id, row.id, today, fase, merged[a.con_quien] || null, merged[a.que_dije] || null,
        merged[a.cuerpo] || null, now));
    } else if (prev.estado === 'pendiente') {
      stmts.push(env.DB.prepare(
        'UPDATE identity_act_drafts SET con_quien = ?, que_dije = ?, cuerpo = ?, updated_at = ? WHERE id = ?',
      ).bind(merged[a.con_quien] || null, merged[a.que_dije] || null, merged[a.cuerpo] || null, now, prev.id));
    }
  }

  if (stmts.length) await env.DB.batch(stmts);
}

// ---------- Cuidado ----------

export async function markCare(context, row, section) {
  const { env, request } = context;
  const now = nowIso();
  const recent = await env.DB.prepare(
    "SELECT at FROM kit_events WHERE kit_id = ? AND tipo = 'cuidado' ORDER BY at DESC LIMIT 1",
  ).bind(row.id).first();
  await env.DB.batch([
    env.DB.prepare('UPDATE kits SET cuidado_at = ? WHERE id = ?').bind(now, row.id),
    env.DB.prepare('UPDATE consultants SET alerta_cuidado = 1, updated_at = ? WHERE id = ?').bind(now, row.consultant_id),
    env.DB.prepare('INSERT INTO kit_events (id, kit_id, tipo, section_key, at) VALUES (?, ?, ?, ?, ?)')
      .bind(newId(), row.id, 'cuidado', String(section || '').slice(0, 40) || null, now),
  ]);
  const twelveHours = 12 * 60 * 60 * 1000;
  if (!recent || Date.now() - Date.parse(recent.at) > twelveHours) {
    const kit = getKit(row.kit_key);
    const origin = new URL(request.url).origin;
    context.waitUntil(notifyMentor(env, {
      subject: `Revisar cuidado: ${row.consultant_nombre} · ${kit?.nombre_panel || 'kit de fase'}`,
      care: 'Marcó "Hoy me está costando mucho / necesito hablar" en su trabajo entre sesiones. Escríbele.',
      lines: [`${row.consultant_nombre} pidió hablar desde el kit ${kit?.nombre_panel || ''}.`],
      link: `${origin}/panel/consultante?id=${encodeURIComponent(row.consultant_id)}`,
    }));
  }
}

// ---------- Entrega ----------

export async function deliver(context, row, values) {
  const { env, request } = context;
  await saveValues(context, row, values, null);
  const now = nowIso();
  const r = await env.DB.prepare('UPDATE kits SET entregado_at = ? WHERE id = ? AND entregado_at IS NULL').bind(now, row.id).run();
  if (!r.meta || r.meta.changes !== 1) throw new HttpError('Este trabajo ya fue entregado.', 409);
  await env.DB.prepare('INSERT INTO kit_events (id, kit_id, tipo, section_key, at) VALUES (?, ?, ?, NULL, ?)')
    .bind(newId(), row.id, 'entregado', now).run();
  const kit = getKit(row.kit_key);
  const origin = new URL(request.url).origin;
  context.waitUntil(notifyMentor(env, {
    subject: `Kit entregado: ${row.consultant_nombre}${row.cuidado_at ? ' · Revisar cuidado' : ''}`,
    care: row.cuidado_at ? 'Durante la semana marcó "necesito hablar".' : null,
    lines: [`${row.consultant_nombre} entregó el trabajo ${kit?.nombre_panel || ''}.`],
    link: `${origin}/panel/kit?id=${encodeURIComponent(row.id)}`,
  }));
}
