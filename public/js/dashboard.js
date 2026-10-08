import { api, h, icon, copy, shell, fmtDate, fmtDateTime, fmtIsoLocal, daysBetween, waLink, errorBox } from './ui.js';
import { faseLabel, ESTADOS, SEMAFORO, TIPOS_FORM, CICLO_DIAS } from './method.js';

shell('panel');

const content = document.getElementById('content');
const newBtn = document.getElementById('newBtn');
newBtn.append(icon('plus'), 'Nueva consultante');

const ACTIVE = ['activo', 'diagnostico'];

function cycleInfo(c, today) {
  if (!c.fase_inicio || c.fase_actual === 0) return null;
  const day = daysBetween(c.fase_inicio, today) + 1;
  if (day < 1) return null;
  return { day, pct: Math.min(100, (day / CICLO_DIAS) * 100) };
}

function semaforo(value) {
  const cls = value || 'none';
  return h('span', { class: `sem ${cls}` }, h('i'), value ? SEMAFORO[value] : 'Sin sesiones');
}

function consultantCard(c, today) {
  const cyc = cycleInfo(c, today);
  return h('a', { class: 'card', href: `/panel/consultante?id=${encodeURIComponent(c.id)}` },
    h('div', { class: 'c-name' }, c.nombre,
      c.alerta_cuidado ? h('span', { title: 'Alerta de cuidado', 'aria-label': 'Alerta de cuidado' }, icon('alert', 'i icon-alert')) : null),
    h('div', { class: 'c-meta' },
      h('div', { class: 'row' }, h('span', { class: 'pill' }, faseLabel(c.fase_actual)),
        c.estado !== 'activo' ? h('span', { class: 'pill line' }, ESTADOS[c.estado]) : null),
      cyc ? h('div', { class: 'cycle' },
        h('span', { class: 'small muted num' }, cyc.day <= CICLO_DIAS ? `Día ${cyc.day} de ${CICLO_DIAS}` : `Día ${cyc.day} · ciclo de ${CICLO_DIAS} cumplido`),
        h('div', { class: 'cycle-bar' }, h('span', { style: `width:${cyc.pct}%` }))) : null,
      h('div', { class: 'spread' }, semaforo(c.ultimo_semaforo),
        c.proxima_sesion ? h('span', { class: 'small muted num' }, `Próxima: ${fmtDateTime(c.proxima_sesion)}`) : null),
    ),
  );
}

function section(title, ...body) {
  return h('section', { class: 'section' }, h('div', { class: 'section-head' }, h('h2', {}, title)), ...body);
}

function render(d) {
  const today = d.today;
  document.getElementById('today').textContent = fmtDate(today);
  const out = [];

  const alerts = d.consultants.filter((c) => c.alerta_cuidado);
  if (alerts.length) {
    out.push(h('div', { class: 'section', style: 'margin-top:0' },
      ...alerts.map((c) => h('div', { class: 'care-band', role: 'alert' },
        h('div', { class: 'row', style: 'flex-wrap:nowrap;align-items:flex-start' }, icon('alert', 'i icon-alert'),
          h('p', { class: 'voice' }, `${c.nombre} marcó una señal de cuidado. Escríbele antes de la próxima sesión.`)),
        h('a', { href: `/panel/consultante?id=${encodeURIComponent(c.id)}` }, 'Abrir ficha')))));
  }

  const active = d.consultants.filter((c) => ACTIVE.includes(c.estado));
  out.push(section('En proceso',
    active.length
      ? h('div', { class: 'cards' }, ...active.map((c) => consultantCard(c, today)))
      : h('p', { class: 'empty' }, 'Todavía no hay consultantes en proceso. Cuando alguien empiece, cambia su estado a Activo en la ficha.')));

  const grid = h('div', { class: 'grid section' });

  const upcoming = d.consultants
    .filter((c) => c.proxima_sesion && c.proxima_sesion.slice(0, 10) >= today)
    .sort((a, b) => a.proxima_sesion.localeCompare(b.proxima_sesion));
  grid.append(h('div', { class: 'span-6' },
    h('div', { class: 'section-head' }, h('h2', {}, 'Próximas sesiones')),
    upcoming.length
      ? h('div', { class: 'card' }, h('table', { class: 't' }, h('tbody', {},
        ...upcoming.map((c) => h('tr', {},
          h('td', { class: 'num' }, fmtDateTime(c.proxima_sesion)),
          h('td', {}, h('a', { href: `/panel/consultante?id=${encodeURIComponent(c.id)}` }, c.nombre)))))))
      : h('p', { class: 'empty' }, 'No hay sesiones agendadas. Carga la próxima fecha desde cada ficha.')));

  const pendingRows = [
    ...d.pending_forms.map((f) => ({ consultant_id: f.consultant_id, nombre: f.nombre,
      detalle: `${TIPOS_FORM[f.tipo] || f.tipo} · enviado ${fmtIsoLocal(f.enviado_at)}`, link: f.link })),
    ...(d.pending_kits || []).map((k) => ({ consultant_id: k.consultant_id, nombre: k.nombre,
      detalle: `Kit ${k.kit} · ${k.estado === 'en_curso' ? 'en curso' : 'sin empezar'}`, link: k.link })),
  ];
  grid.append(h('div', { class: 'span-6' },
    h('div', { class: 'section-head' }, h('h2', {}, 'Formularios pendientes')),
    pendingRows.length
      ? h('div', { class: 'card' }, h('table', { class: 't' }, h('tbody', {},
        ...pendingRows.map((f) => h('tr', {},
          h('td', {}, h('a', { href: `/panel/consultante?id=${encodeURIComponent(f.consultant_id)}` }, f.nombre),
            h('div', { class: 'small muted' }, f.detalle)),
          h('td', { style: 'text-align:right' },
            h('button', { class: 'btn quiet', type: 'button', onclick: () => copy(f.link), 'aria-label': `Copiar link de ${f.nombre}` }, icon('copy'), 'Copiar link')))))))
      : h('p', { class: 'empty' }, 'No hay formularios esperando respuesta.')));

  if (d.recent_forms.length) {
    grid.append(h('div', { class: 'span-12' },
      h('div', { class: 'section-head' }, h('h2', {}, 'Respondidos recientemente')),
      h('div', { class: 'card' }, h('table', { class: 't' }, h('tbody', {},
        ...d.recent_forms.map((f) => h('tr', {},
          h('td', {}, h('a', { href: `/panel/consultante?id=${encodeURIComponent(f.consultant_id)}` }, f.nombre)),
          h('td', {}, TIPOS_FORM[f.tipo] || f.tipo),
          h('td', { class: 'num muted' }, fmtIsoLocal(f.respondido_at)))))))));
  }
  out.push(grid);

  const others = d.consultants.filter((c) => !ACTIVE.includes(c.estado));
  if (others.length) {
    out.push(section('Otros procesos',
      h('div', { class: 'card table-wrap' }, h('table', { class: 't' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Consultante'), h('th', {}, 'Estado'), h('th', {}, 'Fase'), h('th', {}, 'Ingreso'))),
        h('tbody', {}, ...others.map((c) => h('tr', {},
          h('td', {}, h('a', { href: `/panel/consultante?id=${encodeURIComponent(c.id)}` }, c.nombre),
            c.alerta_cuidado ? h('span', { style: 'margin-left:8px;vertical-align:middle' }, icon('alert', 'i icon-alert')) : null),
          h('td', {}, h('span', { class: 'pill line' }, ESTADOS[c.estado])),
          h('td', {}, faseLabel(c.fase_actual)),
          h('td', { class: 'num muted' }, c.fecha_ingreso ? fmtDate(c.fecha_ingreso) : 'Sin formulario'))))))));
  }

  content.replaceChildren(...out);
}

async function load() {
  try {
    render(await api('/dashboard'));
  } catch (e) {
    errorBox(content, e);
  }
}

// Nueva consultante
const dlg = document.getElementById('newDlg');
const form = document.getElementById('newForm');
newBtn.addEventListener('click', () => {
  form.reset();
  document.getElementById('newStep1').classList.remove('hidden');
  document.getElementById('newStep2').classList.add('hidden');
  document.getElementById('newErr').textContent = '';
  dlg.showModal();
  document.getElementById('n_nombre').focus();
});
dlg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dlg.close()));

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = form.nombre.value.trim();
  const whatsapp = form.whatsapp.value.trim();
  const err = document.getElementById('newErr');
  if (!nombre) { err.textContent = 'Escribe el nombre.'; return; }
  const btn = document.getElementById('newSubmit');
  btn.disabled = true;
  try {
    const r = await api('/consultants', { method: 'POST', body: { nombre, whatsapp } });
    document.getElementById('newLink').value = r.ingreso_link;
    document.getElementById('newFicha').href = `/panel/consultante?id=${encodeURIComponent(r.id)}`;
    const first = nombre.split(/\s+/)[0];
    document.getElementById('newWa').href = waLink(whatsapp,
      `Hola ${first}. Te comparto el formulario de ingreso para preparar nuestra primera sesión: ${r.ingreso_link}`);
    document.getElementById('newCopy').onclick = () => copy(r.ingreso_link);
    document.getElementById('newStep1').classList.add('hidden');
    document.getElementById('newStep2').classList.remove('hidden');
    load();
  } catch (ex) {
    err.textContent = ex.message;
  } finally {
    btn.disabled = false;
  }
});

load();
