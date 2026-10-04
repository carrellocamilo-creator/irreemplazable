import { api, h, icon, toast, shell, fmtDate, todayLocal, choiceGroup, formValues, errorBox } from './ui.js';
import { FASES, faseLabel, SEMAFORO, INTENSIDAD, CUMPLIO, ESTRUCTURA_SESION } from './method.js';

shell('panel');

const params = new URLSearchParams(location.search);
const cid = params.get('c');
const sid = params.get('s');
const content = document.getElementById('content');
const enc = encodeURIComponent;

function field(label, control, hint) {
  return h('div', { class: 'field' },
    h('label', { for: control.id }, label),
    hint ? h('span', { class: 'small muted', style: 'margin-top:-2px' }, hint) : null,
    control);
}
function choiceField(label, group) {
  return h('div', { class: 'field' }, h('span', { class: 'label' }, label), group);
}
function ta(name, value, voice = true, minH) {
  const t = h('textarea', { name, id: `f_${name}`, class: voice ? 'voice-input' : '' });
  t.value = value ?? '';
  if (minH) t.style.minHeight = minH;
  return t;
}
function inp(name, type, value, attrs = {}) {
  return h('input', { name, id: `f_${name}`, type, value: value ?? '', ...attrs });
}

function block(n, title, ...children) {
  return h('section', { class: 'block' },
    h('div', { class: 'block-head' }, h('span', { class: 'block-num' }, String(n)), h('h2', {}, title)),
    ...children);
}

function render(rec, s) {
  const c = rec.consultant;
  const editing = Boolean(s);
  s = s || {};
  // Sesión anterior a esta (para mostrar el compromiso a revisar).
  const ordered = rec.sessions.slice().sort((a, b) => (a.fecha + String(a.numero).padStart(4, '0')).localeCompare(b.fecha + String(b.numero).padStart(4, '0')));
  const idx = editing ? ordered.findIndex((x) => x.id === s.id) : ordered.length;
  const prev = idx > 0 ? ordered[idx - 1] : null;
  const nextNumero = editing ? s.numero : (Math.max(0, ...rec.sessions.map((x) => x.numero || 0)) + 1);

  const semGroup = choiceGroup('semaforo', Object.entries(SEMAFORO).map(([k, l]) => [k, l]), s.semaforo);
  semGroup.querySelectorAll('label').forEach((lab) => {
    const key = lab.htmlFor.split('_').pop();
    lab.prepend(h('span', { class: `sem ${key}` }, h('i')));
  });

  const form = h('form', { novalidate: true },
    block(1, ESTRUCTURA_SESION[0].label,
      h('div', { class: 'fields-3' },
        field('Fecha', inp('fecha', 'date', s.fecha || todayLocal())),
        field('Sesión número', inp('numero', 'number', nextNumero, { min: 0, max: 500 })),
        field('Fase', (() => {
          const sel = h('select', { name: 'fase', id: 'f_fase' });
          for (const n of Object.keys(FASES)) {
            const o = h('option', { value: n }, faseLabel(Number(n)));
            if (Number(n) === (s.fase ?? c.fase_actual)) o.selected = true;
            sel.append(o);
          }
          return sel;
        })())),
      choiceField('Semáforo del cuerpo', semGroup),
      field('Cómo llega', ta('como_llega', s.como_llega)),
      prev && prev.compromiso_semana
        ? h('div', { class: 'ref' }, h('span', { class: 'small muted' }, `Compromiso de la sesión ${prev.numero ?? ''} · ${fmtDate(prev.fecha)}`),
          h('p', { class: 'voice' }, prev.compromiso_semana))
        : null,
      choiceField('¿Cumplió el compromiso anterior?', choiceGroup('cumplio_compromiso_anterior', Object.entries(CUMPLIO), s.cumplio_compromiso_anterior))),

    block(2, ESTRUCTURA_SESION[1].label,
      field('Notas del mentor', ta('notas_mentor', s.notas_mentor, true, '180px'), 'Lo que apareció, patrones, lo que quedó abierto.')),

    block(3, ESTRUCTURA_SESION[2].label,
      field('Técnica usada', inp('tecnica_usada', 'text', s.tecnica_usada)),
      choiceField('Intensidad', choiceGroup('intensidad', Object.entries(INTENSIDAD), s.intensidad))),

    block(4, ESTRUCTURA_SESION[3].label,
      field('Lo que se lleva', ta('lo_que_se_lleva', s.lo_que_se_lleva), 'En sus propias palabras.')),

    block(5, ESTRUCTURA_SESION[4].label,
      field('Compromiso de la semana', ta('compromiso_semana', s.compromiso_semana)),
      !editing ? field('Próxima sesión', inp('proxima_sesion', 'datetime-local', c.proxima_sesion ? c.proxima_sesion.slice(0, 16) : ''), 'Opcional. Se guarda en la ficha.') : null),
  );

  const err = h('p', { class: 'err-msg', role: 'alert' });
  const submit = h('button', { class: 'btn primary', type: 'submit' }, editing ? 'Guardar cambios' : 'Registrar sesión');
  const actions = h('div', { class: 'spread', style: 'margin-top:40px' },
    h('div', {}, submit, err),
    editing ? h('button', { class: 'btn danger', type: 'button', onclick: async () => {
      if (!confirm('¿Eliminar esta sesión?')) return;
      try {
        await api(`/sessions/${enc(s.id)}`, { method: 'DELETE' });
        location.href = `/panel/consultante?id=${enc(cid)}`;
      } catch (e) { err.textContent = e.message; }
    } }, icon('trash'), 'Eliminar sesión') : null);
  form.append(actions);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    const v = formValues(form);
    if (!v.fecha) { err.textContent = 'La fecha es obligatoria.'; return; }
    const proxima = v.proxima_sesion;
    delete v.proxima_sesion;
    submit.disabled = true;
    try {
      if (editing) {
        await api(`/sessions/${enc(s.id)}`, { method: 'PUT', body: v });
      } else {
        await api(`/consultants/${enc(cid)}/sessions`, { method: 'POST', body: v });
        if (proxima !== undefined && proxima !== (c.proxima_sesion || '').slice(0, 16)) {
          await api(`/consultants/${enc(cid)}`, { method: 'PATCH', body: { proxima_sesion: proxima || null } });
        }
      }
      toast('Sesión guardada.');
      location.href = `/panel/consultante?id=${enc(cid)}`;
    } catch (ex) {
      err.textContent = ex.message;
      submit.disabled = false;
    }
  });

  document.title = `${editing ? 'Sesión' : 'Registrar sesión'} · ${c.nombre}`;
  content.replaceChildren(
    h('a', { class: 'back', href: `/panel/consultante?id=${enc(cid)}` }, icon('back'), c.nombre),
    h('div', { class: 'page-head', style: 'margin-bottom:0' },
      h('div', {}, h('h1', {}, editing ? `Sesión ${s.numero ?? ''}` : 'Registrar sesión'),
        h('p', { class: 'muted' }, `${c.nombre} · ${faseLabel(c.fase_actual)}`))),
    form,
  );
}

async function load() {
  if (!cid) { errorBox(content, new Error('Falta indicar la consultante.')); return; }
  try {
    const rec = await api(`/consultants/${enc(cid)}`);
    const s = sid ? rec.sessions.find((x) => x.id === sid) : null;
    if (sid && !s) throw new Error('No existe esa sesión.');
    render(rec, s);
  } catch (e) {
    errorBox(content, e);
  }
}

load();
