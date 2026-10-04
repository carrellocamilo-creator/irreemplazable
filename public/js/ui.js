// Utilidades compartidas del panel.

export async function api(path, opts = {}) {
  const res = await fetch(`/api/admin${path}`, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  if (!res.ok) {
    if (res.status === 401) throw new Error('Tu sesión expiró. Recarga la página para volver a entrar.');
    throw new Error((data && data.error) || 'No se pudo completar la acción.');
  }
  return data;
}

// Creación de elementos sin innerHTML para datos (evita inyección).
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v; // solo para íconos estáticos
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// Íconos Lucide (outline, trazo 1.5).
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  alert: '<path d="m10.3 3.9-8.5 14.6A2 2 0 0 0 3.5 21.5h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  message: '<path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2-5.6A8.4 8.4 0 1 1 21 11.5Z"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
};
export function icon(name, cls = 'i') {
  const span = document.createElement('span');
  span.innerHTML = `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  return span.firstChild;
}

export function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = h('div', { class: 'toast', role: 'status' }); document.body.append(t); }
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('on'), 2400);
}

export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Link copiado.');
  } catch {
    window.prompt('Copia el link:', text);
  }
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function fmtDate(s) {
  if (!s) return '';
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  if (!y) return s;
  return `${d} ${MESES[m - 1]} ${y}`;
}
export function fmtDateTime(s) {
  if (!s) return '';
  const base = fmtDate(s);
  const time = s.length > 10 ? s.slice(11, 16) : '';
  return time ? `${base} · ${time}` : base;
}
export function fmtIsoLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');
}

export function daysBetween(a, b) {
  const da = Date.UTC(...a.slice(0, 10).split('-').map((n, i) => (i === 1 ? n - 1 : +n)));
  const db = Date.UTC(...b.slice(0, 10).split('-').map((n, i) => (i === 1 ? n - 1 : +n)));
  return Math.round((db - da) / 86400000);
}

export function todayLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function waLink(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '');
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}

// Grupo de opciones tipo pastilla (radio).
export function choiceGroup(name, options, value, { scale = false } = {}) {
  const wrap = h('div', { class: `choice${scale ? ' scale' : ''}`, role: 'radiogroup' });
  for (const [val, label] of options) {
    const id = `${name}_${val}`;
    const input = h('input', { type: 'radio', name, id, value: val });
    if (String(value) === String(val)) input.checked = true;
    wrap.append(input, h('label', { for: id }, label));
  }
  return wrap;
}

export function range(n, start = 1) {
  return Array.from({ length: n }, (_, i) => [String(i + start), String(i + start)]);
}

export function formValues(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; else if (!(el.name in out)) out[el.name] = null; }
    else if (el.type === 'checkbox') out[el.name] = el.checked;
    else out[el.name] = el.value;
  }
  return out;
}

export function errorBox(container, e) {
  container.replaceChildren(h('p', { class: 'empty' }, e.message || String(e)));
}

// Navegación lateral común.
export function shell(active) {
  const side = document.querySelector('.side');
  if (!side) return;
  side.replaceChildren(
    h('a', { href: '/panel/', class: 'logo' }, 'IRREEMPLAZABLE',
      h('span', { class: 'logo-sub' }, 'Mentor en Reconstrucción de Identidad')),
    h('nav', { class: 'nav', 'aria-label': 'Principal' },
      h('a', { href: '/panel/', 'aria-current': active === 'panel' ? 'page' : null }, icon('home'), 'Panel')),
    h('div', { class: 'side-foot' },
      h('a', { href: '/api/admin/backup' }, 'Descargar respaldo completo'),
      h('a', { href: '/cdn-cgi/access/logout' }, 'Cerrar sesión')),
  );
}
