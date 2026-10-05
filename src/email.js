// Aviso por email al mentor. Usa EmailJS si está configurado; si no, Resend.
// Por privacidad, el email nunca incluye respuestas: solo avisa y lleva a la ficha,
// que está protegida por Cloudflare Access.

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export async function notifyMentor(env, { subject, lines, link, care }) {
  if (!env.MENTOR_EMAIL || !(env.EMAILJS_SERVICE_ID || env.RESEND_API_KEY)) {
    console.warn('Aviso por email sin configurar (EmailJS o Resend, y MENTOR_EMAIL).');
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

  if (env.EMAILJS_SERVICE_ID) return sendEmailJS(env, { subject, text, link, care });

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

// EmailJS: la plantilla usa {{to_email}}, {{subject}}, {{message}}, {{care}} y {{link}}.
async function sendEmailJS(env, { subject, text, link, care }) {
  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: env.EMAILJS_SERVICE_ID,
        template_id: env.EMAILJS_TEMPLATE_ID,
        user_id: env.EMAILJS_PUBLIC_KEY,
        accessToken: env.EMAILJS_PRIVATE_KEY,
        template_params: {
          to_email: env.MENTOR_EMAIL,
          subject,
          message: text,
          care: care || '',
          link: link || '',
        },
      }),
    });
    if (!res.ok) console.error('EmailJS respondió', res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error('Error enviando email (EmailJS)', e);
    return false;
  }
}
