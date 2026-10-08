// Kit de fase para la consultante (link con token único).
// El token permite leer y editar solo las respuestas de este kit, y solo hasta entregarlo.

import { json, error, HttpError } from '../../../src/http.js';
import { getKit } from '../../../src/kits/index.js';
import { findKitByToken, parseConfig, personalize, loadAnswers, currentValue } from '../../../src/kit-store.js';

export async function onRequestGet({ params, env }) {
  try {
    const row = await findKitByToken(env, params.token);
    const kit = row && getKit(row.kit_key);
    if (!kit) return error('Este enlace no es válido.', 404);
    const def = personalize(kit, parseConfig(row));
    if (row.entregado_at) {
      return json({ estado: 'entregado', kit: { title: def.title, subtitle: def.subtitle, cierre: def.cierre } });
    }
    const answers = {};
    const answered_at = {};
    for (const a of await loadAnswers(env, row.id)) {
      answers[a.field_key] = currentValue(a);
      answered_at[a.field_key] = a.final_at || a.primera_at;
    }
    const ev = await env.DB.prepare(
      "SELECT section_key, MAX(at) AS at FROM kit_events WHERE kit_id = ? AND tipo = 'guardado' GROUP BY section_key",
    ).bind(row.id).all();
    const saved = Object.fromEntries((ev.results || []).map((e) => [e.section_key, e.at]));
    return json({
      estado: row.started_at ? 'en_curso' : 'sin_empezar',
      kit: def,
      answers,
      answered_at,
      saved,
      cuidado: Boolean(row.cuidado_at),
    });
  } catch (e) {
    if (e instanceof HttpError) return error(e.message, e.status);
    console.error(e);
    return error('No se pudo cargar el trabajo.', 500);
  }
}
