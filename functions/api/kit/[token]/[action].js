// Acciones del kit: guardar un día, marcar cuidado, entregar.

import { json, error, readJson, HttpError } from '../../../../src/http.js';
import { findKitByToken, saveValues, markCare, deliver } from '../../../../src/kit-store.js';

export async function onRequestPost(context) {
  const { params, env, request } = context;
  try {
    const row = await findKitByToken(env, params.token);
    if (!row) return error('Este enlace no es válido.', 404);
    const body = await readJson(request);
    switch (params.action) {
      case 'save': {
        if (!body.section) throw new HttpError('Falta la sección.');
        const r = await saveValues(context, row, body.values || {}, String(body.section));
        return json({ ok: true, ...r });
      }
      case 'care':
        await markCare(context, row, body.section);
        return json({ ok: true });
      case 'deliver':
        await deliver(context, row, body.values || {});
        return json({ ok: true });
      default:
        return error('Acción no válida.', 404);
    }
  } catch (e) {
    if (e instanceof HttpError) return error(e.message, e.status);
    console.error(e);
    return error('No se pudo guardar. Intenta de nuevo.', 500);
  }
}
