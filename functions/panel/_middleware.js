// Segunda capa de protección para las pantallas del panel.
import { verifyAccess } from '../../src/auth.js';

export async function onRequest(context) {
  const email = await verifyAccess(context.request, context.env);
  if (!email) {
    return new Response('Acceso privado.', {
      status: 401,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  const res = await context.next();
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', 'no-store');
  return out;
}
