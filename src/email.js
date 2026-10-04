// Aviso por email al mentor (Resend).
// Por privacidad, el email nunca incluye respuestas: solo avisa y lleva a la ficha,
// que está protegida por Cloudflare Access.

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export async function notifyMentor(env, { subject, lines, link, care }) {
  if (!env.RESEND_API_KEY || !env.MENTOR_EMAIL) {
    console.warn('Aviso por email sin configurar (RESEND_API_KEY o MENTOR_EMAIL).');
    return false;
  }
  const careBlock = care
    ? `<p style="border-left:3px solid #9C3A2C;background:#F6E4E0;padding:12px 14px;margin:0 0 18px;font-family:Georgia,serif;color:#1C2320">${esc(care)}</p>`
    : '';
  const html = `
    <div style="font-family:system-ui,sans-serif;color:#1C2320;max-width:560px">
      <p style="font-weight:600;letter-spacing:.06em;color:#2E4A41;margin:0 0 24px">IRREEMPLAZABLE</p>
      ${careBlock}
      ${lines.map((l) => `<p style="font-family:Georgia,serif;font-size:17px;line-height:1.6;margin:0 0 12px">${esc(l)}</p>`).join('')}
      ${link ? `<p style="margin:24px 0 0"><a href="${esc(link)}" style="color:#2E4A41">Abrir la ficha</a></p>` : ''}
    </div>`;
  const text = [care, ...lines, link ? `Abrir la ficha: ${link}` : ''].filter(Boolean).join('\n\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.EMAIL_FROM || 'IRREEMPLAZABLE <onboarding@resend.dev>',
        to: [env.MENTOR_EMAIL],
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) console.error('Resend respondió', res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error('Error enviando email', e);
    return false;
  }
}
