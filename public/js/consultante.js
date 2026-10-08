import {
  api, h, icon, copy, toast, shell, fmtDate, fmtDateTime, fmtIsoLocal, daysBetween, todayLocal,
  waLink, choiceGroup, range, formValues, errorBox,
} from './ui.js';
import {
  FASES, faseLabel, ESTADOS, REGISTROS, ARCON_DIMS, MOMENTOS, INDICADORES, SEMAFORO, INTENSIDAD,
  TIPOS_ACTO, TIPOS_FORM, CICLO_DIAS,
} from './method.js';
import { arconChart, lineChart } from './charts.js';

shell('panel');

const id = new URLSearchParams(location.search).get('id');
const content = document.getElementById('content');
const dlg = document.getElementById('dlg');
const dlgBody = document.getElementById('dlgBody');
let rec = null;

const enc = encodeURIComponent;

// ---------- Diálogos ----------

function openDialog(title, bodyNodes, { submitLabel = 'Guardar', onSubmit, danger = false } = {}) {
  const err = h('p', { class: 'err-msg', role: 'alert' });
  const submit = h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, type: 'submit' }, submitLabel);
  const form = h('form', { novalidate: true },
    h('h2', {}, title), ...bodyNodes, err,
    h('div', { class: 'dlg-actions' },
      h('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Cancelar'), submit));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    submit.disabled = true;
    try {
      await onSubmit(formValues(form), form);
      dlg.close();
      await load();
    } catch (ex) {
      err.textContent = ex.message;
    } finally {
      submit.disabled = false;
    }
  });
  dlgBody.replaceChildren(form);
  dlg.showModal();
  const first = form.querySelector('input:not([type=radio]),select,textarea');
  if (first) first.focus();
  return form;
}

function field(label, control, extra) {
  return h('div', { class: 'field' }, typeof label === 'string' ? h('label', { for: control.id }, label) : label, control, extra);
}

function select(name, options, value) {
  const el = h('select', { name, id: `f_${name}` });
  for (const [v, l] of options) {
    const o = h('option', { value: v }, l);
    if (String(v) === String(value ?? '')) o.selected = true;
    el.append(o);
  }
  return el;
}

function input(name, type, value, attrs = {}) {
  return h('input', { name, id: `f_${name}`, type, value: value ?? '', ...attrs });
}

function textarea(name, value, cls = '') {
  const t = h('textarea', { name, id: `f_${name}`, class: cls });
  t.value = value ?? '';
  return t;
}

function scaleField(name, label, n, value, ends, question) {
  return h('div', { class: 'field' },
    h('span', { class: question ? 'q' : 'label' }, label),
    choiceGroup(name, range(n), value, { scale: true }),
    ends ? h('div', { class: 'scale-ends', style: `max-width:${n * 42}px` }, h('span', {}, ends[0]), h('span', {}, ends[1])) : null);
}

// ---------- Acciones ----------

function editDatos() {
  const c = rec.consultant;
  openDialog('Datos de la consultante', [
    field('Nombre', input('nombre', 'text', c.nombre)),
    h('div', { class: 'fields-2' },
      field('Email', input('email', 'email', c.email)),
      field('WhatsApp', input('whatsapp', 'tel', c.whatsapp)),
      field('Edad', input('edad', 'number', c.edad, { min: 18, max: 99 })),
      field('Ciudad y país', input('ciudad_pais', 'text', c.ciudad_pais)),
      field('Ocupación o rol', input('rol', 'text', c.rol)),
      field('Fecha de ingreso', input('fecha_ingreso', 'date', c.fecha_ingreso))),
  ], {
    onSubmit: (v) => api(`/consultants/${enc(id)}`, { method: 'PATCH', body: v }),
  });
}

function editArcon(preset = {}) {
  const findExisting = (m, q) => rec.arcon.find((a) => a.momento === m && a.quien === q);
  const momento = preset.momento || 'sesion0';
  const quien = preset.quien || 'mentor';
  const ex = findExisting(momento, quien) || {};
  const dimsWrap = h('div', {});
  const renderDims = (vals) => dimsWrap.replaceChildren(...ARCON_DIMS.map((d) =>
    scaleField(d.key, `${d.label} · ${d.pregunta}`, 5, vals[d.key], d.ends, true)));
  renderDims(ex);

  const form = openDialog('Cargar ARCON', [
    h('div', { class: 'fields-2' },
      field('Momento', select('momento', MOMENTOS.map((m) => [m.key, m.label]), momento)),
      field('Fecha', input('fecha', 'date', ex.fecha || todayLocal()))),
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Quién mide'),
      choiceGroup('quien', [['consultante', 'Consultante'], ['mentor', 'Mentor']], quien)),
    h('p', { class: 'small muted', style: 'margin:-8px 0 16px' }, 'Si ya hay una medición para ese momento y esa persona, se reemplaza.'),
    dimsWrap,
  ], {
    onSubmit: (v) => api(`/consultants/${enc(id)}/arcon`, { method: 'POST', body: v }),
  });
  const refresh = () => {
    const v = formValues(form);
    const e = findExisting(v.momento, v.quien) || {};
    renderDims(e);
    if (e.fecha) form.fecha.value = e.fecha;
  };
  form.momento.addEventListener('change', refresh);
  form.querySelectorAll('input[name=quien]').forEach((r) => r.addEventListener('change', refresh));
}

function addIndicadores() {
  openDialog('Cargar indicadores', [
    field('Fecha', input('fecha', 'date', todayLocal())),
    ...INDICADORES.map((i) => scaleField(i.key, i.label, 10, null, i.ends)),
    field('Malestar que se repite', textarea('sintoma_descripcion', '', 'voice-input')),
  ], {
    onSubmit: (v) => api(`/consultants/${enc(id)}/indicators`, { method: 'POST', body: v }),
  });
}

function addActo() {
  const c = rec.consultant;
  openDialog('Registrar acto de identidad', [
    h('div', { class: 'fields-2' },
      field('Fecha', input('fecha', 'date', todayLocal())),
      field('Fase', select('fase', Object.keys(FASES).map((n) => [n, faseLabel(Number(n))]), c.fase_actual))),
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Tipo'),
      choiceGroup('tipo', Object.entries(TIPOS_ACTO), null)),
    field('Qué hizo', textarea('descripcion', '', 'voice-input')),
  ], {
    onSubmit: (v) => api(`/consultants/${enc(id)}/acts`, { method: 'POST', body: v }),
  });
}

function confirmDelete() {
  const c = rec.consultant;
  openDialog('Eliminar todos los datos', [
    h('p', { class: 'voice', style: 'margin:0 0 16px' },
      `Se borran la ficha, formularios, sesiones, mediciones y notas de ${c.nombre}. No se puede deshacer.`),
    h('p', { class: 'small muted', style: 'margin:0 0 16px' }, 'Antes de borrar, descarga la exportación si la consultante la pidió.'),
    field(`Escribe "${c.nombre}" para confirmar`, input('confirm', 'text', '', { autocomplete: 'off' })),
  ], {
    submitLabel: 'Eliminar definitivamente',
    danger: true,
    onSubmit: async (v) => {
      if (v.confirm.trim() !== c.nombre.trim()) throw new Error('El nombre no coincide.');
      await api(`/consultants/${enc(id)}`, { method: 'DELETE' });
      location.href = '/panel/';
    },
  });
}

async function patch(body, msg = 'Guardado.') {
  await api(`/consultants/${enc(id)}`, { method: 'PATCH', body });
  toast(msg);
  await load();
}

async function newFormLink(tipo) {
  try {
    const r = await api(`/consultants/${enc(id)}/forms`, { method: 'POST', body: { tipo } });
    await load();
    copy(r.link);
  } catch (e) { toast(e.message); }
}

async function revokeForm(formId) {
  if (!confirm('¿Anular este link? Dejará de funcionar.')) return;
  try {
    await api(`/forms/${enc(formId)}`, { method: 'DELETE' });
    toast('Link anulado.');
    await load();
  } catch (e) { toast(e.message); }
}

async function removeRow(path, label) {
  if (!confirm(`¿Eliminar ${label}?`)) return;
  try {
    await api(path, { method: 'DELETE' });
    await load();
  } catch (e) { toast(e.message); }
}

// ---------- Render ----------

function sectionHead(title, ...actions) {
  return h('div', { class: 'section-head' }, h('h2', {}, title), actions.length ? h('div', { class: 'row' }, ...actions) : null);
}

function renderHeader(c) {
  const cyc = c.fase_inicio && c.fase_actual > 0 ? daysBetween(c.fase_inicio, todayLocal()) + 1 : null;
  return h('div', {},
    h('a', { class: 'back', href: '/panel/' }, icon('back'), 'Panel'),
    h('div', { class: 'page-head' },
      h('div', {},
        h('h1', {}, c.nombre),
        h('div', { class: 'row', style: 'margin-top:12px' },
          h('span', { class: 'pill' }, faseLabel(c.fase_actual)),
          h('span', { class: 'pill line' }, ESTADOS[c.estado]),
          c.registro ? h('span', { class: 'pill line' }, `Registro ${REGISTROS[c.registro].toLowerCase()}`) : null,
          cyc && cyc > 0 ? h('span', { class: 'small muted num' }, cyc <= CICLO_DIAS ? `Día ${cyc} de ${CICLO_DIAS}` : `Día ${cyc} · ciclo cumplido`) : null)),
      h('a', { class: 'btn primary', href: `/panel/sesion?c=${enc(id)}` }, icon('plus'), 'Registrar sesión')));
}

function renderCare(c) {
  if (!c.alerta_cuidado) return null;
  return h('div', { class: 'care-band', role: 'alert', style: 'margin-bottom:32px' },
    h('div', { class: 'row', style: 'flex-wrap:nowrap;align-items:flex-start' }, icon('alert', 'i icon-alert'),
      h('p', { class: 'voice' }, 'Señal de cuidado activa. Escríbele antes de la próxima sesión y evalúa si necesita acompañamiento profesional en paralelo.')),
    h('button', { class: 'btn', type: 'button', onclick: () => {
      if (confirm('¿Ya lo conversaron y quieres desactivar la alerta?')) patch({ alerta_cuidado: false }, 'Alerta desactivada.');
    } }, 'Marcar como atendida'));
}

function renderArcon() {
  const used = new Set(rec.arcon.map((a) => a.momento));
  const moments = MOMENTOS.filter((m) => !(m.sosten || m.kit) || used.has(m.key));
  const byWho = (q) => Object.fromEntries(rec.arcon.filter((a) => a.quien === q).map((a) => [a.momento, a]));
  const cons = byWho('consultante');
  const ment = byWho('mentor');
  const body = rec.arcon.length
    ? [
      h('div', { class: 'charts' }, ...ARCON_DIMS.map((d) => {
        const pick = (src) => Object.fromEntries(Object.entries(src).map(([k, a]) => [k, a[d.key]]));
        return h('div', { class: 'chart' }, h('h3', {}, d.label),
          arconChart({ moments, consultant: pick(cons), mentor: pick(ment), title: `${d.label}: consultante y mentor por momento` }));
      })),
      h('div', { class: 'legend' },
        h('span', {}, h('i'), 'Consultante'), h('span', {}, h('i', { class: 'm' }), 'Mentor'), h('span', {}, h('i', { class: 'g' }), 'Brecha')),
      h('details', { style: 'margin-top:16px' }, h('summary', { class: 'small', style: 'cursor:pointer;color:var(--pine)' }, 'Ver mediciones'),
        h('div', { class: 'table-wrap' }, h('table', { class: 't', style: 'margin-top:8px' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Momento'), h('th', {}, 'Quién'),
            ...ARCON_DIMS.map((d) => h('th', { class: 'num', title: d.label }, d.letra)), h('th', {}, 'Fecha'), h('th', {}))),
          h('tbody', {}, ...rec.arcon
            .slice().sort((a, b) => MOMENTOS.findIndex((m) => m.key === a.momento) - MOMENTOS.findIndex((m) => m.key === b.momento))
            .map((a) => h('tr', {},
              h('td', {}, MOMENTOS.find((m) => m.key === a.momento)?.label),
              h('td', {}, a.quien === 'mentor' ? 'Mentor' : 'Consultante'),
              ...ARCON_DIMS.map((d) => h('td', { class: 'num' }, a[d.key] ?? '—')),
              h('td', { class: 'num muted' }, fmtDate(a.fecha)),
              h('td', { style: 'text-align:right;white-space:nowrap' },
                h('button', { class: 'btn quiet', type: 'button', onclick: () => editArcon({ momento: a.momento, quien: a.quien }), 'aria-label': 'Editar' }, icon('edit')),
                h('button', { class: 'btn quiet danger', type: 'button', onclick: () => removeRow(`/arcon/${enc(a.id)}`, 'esta medición'), 'aria-label': 'Eliminar' }, icon('trash'))))))))),
    ]
    : [h('p', { class: 'empty' }, 'Todavía no hay mediciones ARCON. Llegan con el formulario de ingreso o puedes cargarlas a mano.')];
  return h('section', { class: 'section card' },
    sectionHead('ARCON', h('button', { class: 'btn', type: 'button', onclick: () => editArcon() }, icon('plus'), 'Cargar ARCON')),
    ...body);
}

function renderIndicadores() {
  const rows = rec.indicators;
  const body = rows.length
    ? [
      h('div', { class: 'charts four' }, ...INDICADORES.map((i) => {
        const pts = rows.filter((r) => r[i.key] != null).map((r) => ({ fecha: r.fecha, valor: r[i.key] }));
        return h('div', { class: 'chart' }, h('h3', {}, i.label),
          pts.length ? lineChart({ points: pts, title: `${i.label} en el tiempo` }) : h('p', { class: 'small muted' }, 'Sin datos'));
      })),
      h('details', { style: 'margin-top:16px' }, h('summary', { class: 'small', style: 'cursor:pointer;color:var(--pine)' }, 'Ver registros'),
        h('div', { class: 'table-wrap' }, h('table', { class: 't', style: 'margin-top:8px' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Fecha'), ...INDICADORES.map((i) => h('th', { class: 'num' }, i.label)), h('th', {}, 'Malestar'), h('th', {}))),
          h('tbody', {}, ...rows.slice().reverse().map((r) => h('tr', {},
            h('td', { class: 'num' }, fmtDate(r.fecha)),
            ...INDICADORES.map((i) => h('td', { class: 'num' }, r[i.key] ?? '—')),
            h('td', {}, r.sintoma_descripcion || ''),
            h('td', { style: 'text-align:right' },
              h('button', { class: 'btn quiet danger', type: 'button', onclick: () => removeRow(`/indicators/${enc(r.id)}`, 'este registro'), 'aria-label': 'Eliminar' }, icon('trash'))))))))),
    ]
    : [h('p', { class: 'empty' }, 'Todavía no hay indicadores. Llegan con el formulario de ingreso o puedes cargarlos a mano.')];
  return h('section', { class: 'section card' },
    sectionHead('Indicadores', h('button', { class: 'btn', type: 'button', onclick: addIndicadores }, icon('plus'), 'Cargar indicadores')),
    ...body);
}

function ingresoAnswers() {
  const f = rec.forms.find((x) => x.tipo === 'ingreso' && x.respuestas_json);
  if (!f) return null;
  let data;
  try { data = JSON.parse(f.respuestas_json); } catch { return null; }
  return { form: f, data };
}

function kitEstado(k) {
  if (k.estado === 'entregado') return `Entregado ${fmtIsoLocal(k.entregado_at)}`;
  if (k.estado === 'en_curso') return `En curso · ${k.dias_guardados} ${k.dias_guardados === 1 ? 'día guardado' : 'días guardados'}`;
  return 'Sin empezar';
}

function renderActDrafts() {
  const drafts = (rec.identity_act_drafts || []).filter((d) => d.estado === 'pendiente');
  if (!drafts.length) return null;
  return h('div', { style: 'margin-bottom:24px' },
    h('p', { class: 'small muted', style: 'margin:0 0 8px' }, 'Por confirmar: acción real propuesta desde el kit'),
    ...drafts.map((d) => h('div', { style: 'background:var(--ochre-soft);border-radius:var(--r-field);padding:14px 16px;margin-bottom:8px' },
      h('dl', { class: 'data' },
        h('dt', {}, 'Con quién'), h('dd', { class: 'voice', style: 'font-size:16px' }, d.con_quien || '—'),
        h('dt', {}, 'Qué dijo'), h('dd', { class: 'voice', style: 'font-size:16px' }, d.que_dije || '—'),
        h('dt', {}, 'En el cuerpo'), h('dd', { class: 'voice', style: 'font-size:16px' }, d.cuerpo || '—')),
      h('div', { class: 'row', style: 'margin-top:10px;gap:6px' },
        h('button', { class: 'btn', type: 'button', onclick: () => confirmDraft(d) }, 'Confirmar como acto de identidad'),
        h('button', { class: 'btn quiet', type: 'button', onclick: () => discardDraft(d) }, 'Descartar')))));
}

function confirmDraft(d) {
  const desc = [d.con_quien && `Con ${d.con_quien}`, d.que_dije && `Dijo: ${d.que_dije}`, d.cuerpo && `En el cuerpo: ${d.cuerpo}`].filter(Boolean).join('. ');
  openDialog('Confirmar acto de identidad', [
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Tipo'), choiceGroup('tipo', Object.entries(TIPOS_ACTO), 'conversacion')),
    field('Descripción', textarea('descripcion', desc, 'voice-input')),
  ], {
    submitLabel: 'Confirmar',
    onSubmit: (v) => api(`/act-drafts/${enc(d.id)}`, { method: 'POST', body: { estado: 'confirmado', tipo: v.tipo, descripcion: v.descripcion } }),
  });
}

async function discardDraft(d) {
  if (!confirm('¿Descartar esta acción como acto de identidad? Queda guardada en el kit.')) return;
  try {
    await api(`/act-drafts/${enc(d.id)}`, { method: 'POST', body: { estado: 'descartado' } });
    await load();
  } catch (e) { toast(e.message); }
}

async function setProposal(pid, estado) {
  try {
    await api(`/witness-proposals/${enc(pid)}`, { method: 'PATCH', body: { estado } });
    await load();
  } catch (e) { toast(e.message); }
}

let kitCatalog = null;
async function newKitLink() {
  try {
    if (!kitCatalog) kitCatalog = await api('/kits');
  } catch (e) { toast(e.message); return; }
  const kits = kitCatalog.kits;
  if (!kits.length) { toast('No hay kits definidos.'); return; }
  const varsBox = h('div', {});
  const renderVars = (key) => {
    const k = kits.find((x) => x.key === key) || kits[0];
    varsBox.replaceChildren(...Object.entries(k.vars || {}).map(([name, spec]) => field(spec.label,
      spec.type === 'textarea' ? textarea(`var_${name}`, spec.default, 'voice-input') : input(`var_${name}`, 'text', spec.default))));
  };
  const kitSel = select('kit_key', kits.map((k) => [k.key, k.nombre]), kits[0].key);
  kitSel.addEventListener('change', () => renderVars(kitSel.value));
  renderVars(kits[0].key);
  openDialog('Generar link del kit', [
    field('Kit', kitSel),
    h('div', { class: 'fields-2' },
      field('Fecha y hora límite (en su hora local)', input('deadline', 'datetime-local', '')),
      field('Zona horaria de la consultante', select('tz', [['', 'Sin especificar'], ...Object.entries(kitCatalog.zonas).map(([z, l]) => [z, l.replace(/^hora /, '')])], 'Asia/Shanghai'))),
    h('details', { open: true }, h('summary', { class: 'small', style: 'cursor:pointer;color:var(--pine);margin-bottom:12px' }, 'Textos personalizables para esta consultante'), varsBox),
  ], {
    submitLabel: 'Generar y copiar link',
    onSubmit: async (v) => {
      const vars = {};
      for (const [k, val] of Object.entries(v)) if (k.startsWith('var_')) vars[k.slice(4)] = val;
      const r = await api(`/consultants/${enc(id)}/kits`, { method: 'POST', body: { kit_key: v.kit_key, deadline: v.deadline || null, tz: v.tz || null, vars } });
      copy(r.link);
    },
  });
}

async function revokeKit(kid) {
  if (!confirm('¿Anular este link? Dejará de funcionar.')) return;
  try {
    await api(`/kits/${enc(kid)}`, { method: 'DELETE' });
    toast('Link anulado.');
    await load();
  } catch (e) { toast(e.message); }
}

function renderTimeline() {
  const ev = [];
  for (const s of rec.sessions) {
    ev.push({ fecha: s.fecha, kind: 'session',
      title: h('a', { href: `/panel/sesion?c=${enc(id)}&s=${enc(s.id)}` }, `Sesión ${s.numero ?? ''} · ${faseLabel(s.fase)}`),
      meta: s.semaforo ? h('span', { class: `sem ${s.semaforo}`, style: 'margin-left:10px' }, h('i'), SEMAFORO[s.semaforo]) : null,
      body: s.lo_que_se_lleva ? `“${s.lo_que_se_lleva}”` : null });
  }
  for (const f of rec.forms) {
    if (!f.respondido_at) continue;
    ev.push({ fecha: f.respondido_at.slice(0, 10), kind: 'form', title: `Formulario de ${(TIPOS_FORM[f.tipo] || f.tipo).toLowerCase()} respondido` });
    let crisis = false;
    try { crisis = JSON.parse(f.respuestas_json || '{}').campos?.s_crisis === 'Sí'; } catch { /* nada */ }
    if (crisis) ev.push({ fecha: f.respondido_at.slice(0, 10), kind: 'alert', title: 'Señal de cuidado en el formulario de ingreso' });
  }
  for (const a of rec.identity_acts) {
    ev.push({ fecha: a.fecha, kind: 'act',
      title: h('span', {}, 'Acto de identidad', a.tipo ? h('span', { class: 'pill ochre', style: 'margin-left:10px' }, TIPOS_ACTO[a.tipo]) : null),
      body: a.descripcion,
      del: () => removeRow(`/acts/${enc(a.id)}`, 'este acto de identidad') });
  }
  for (const k of rec.checkins) {
    ev.push({ fecha: k.fecha, kind: 'checkin', title: `Check-in semana ${k.semana ?? ''}`, body: k.texto });
  }
  for (const k of rec.kits || []) {
    const fecha = (k.entregado_at || k.ultimo_guardado || k.created_at).slice(0, 10);
    ev.push({ fecha, kind: 'form',
      title: h('a', { href: `/panel/kit?id=${enc(k.id)}` }, `Kit · ${k.nombre}`),
      meta: h('span', { class: `pill${k.estado === 'entregado' ? '' : ' line'}`, style: 'margin-left:10px' }, kitEstado(k)) });
    for (const at of k.cuidados || []) {
      ev.push({ fecha: at.slice(0, 10), kind: 'alert', title: `Pidió hablar desde el kit · ${k.nombre}` });
    }
  }
  ev.sort((a, b) => b.fecha.localeCompare(a.fecha));

  return h('section', { class: 'section card' },
    sectionHead('Línea de tiempo', h('button', { class: 'btn', type: 'button', onclick: addActo }, icon('plus'), 'Acto de identidad')),
    renderActDrafts(),
    ev.length
      ? h('ul', { class: 'timeline' }, ...ev.map((e) => h('li', {},
        h('span', { class: `mk ${e.kind}`, 'aria-hidden': 'true' }),
        h('div', { class: 'tl-date' }, fmtDate(e.fecha)),
        h('div', { class: 'spread' }, h('div', { class: 'tl-title' }, e.title, e.meta || null),
          e.del ? h('button', { class: 'btn quiet danger', type: 'button', onclick: e.del, 'aria-label': 'Eliminar' }, icon('trash')) : null),
        e.body ? h('div', { class: 'tl-body' }, e.body) : null)))
      : h('p', { class: 'empty' }, 'Todavía no hay sesiones. Registra la primera al cerrar el encuentro.'));
}

function renderIngreso() {
  const ing = ingresoAnswers();
  if (!ing) return null;
  const labels = ing.data.etiquetas || {};
  return h('section', { class: 'section card' },
    h('details', { class: 'answers' },
      h('summary', {}, `Respuestas del formulario de ingreso · ${fmtIsoLocal(ing.form.respondido_at)}`),
      h('dl', { class: 'qa' }, ...Object.entries(labels).flatMap(([k, val]) => [h('dt', {}, k), h('dd', {}, val)]))));
}

function renderProceso(c) {
  const form = h('form', { novalidate: true },
    field('Estado', select('estado', Object.entries(ESTADOS), c.estado)),
    field('Fase actual', select('fase_actual', Object.keys(FASES).map((n) => [n, faseLabel(Number(n))]), c.fase_actual)),
    field('Inicio de la fase (día 1 del ciclo)', input('fase_inicio', 'date', c.fase_inicio)),
    field('Próxima sesión', input('proxima_sesion', 'datetime-local', c.proxima_sesion ? c.proxima_sesion.slice(0, 16) : '')),
    field('Registro', select('registro', [['', 'Sin definir'], ...Object.entries(REGISTROS)], c.registro)),
    h('button', { class: 'btn', type: 'submit' }, 'Guardar cambios'));
  form.fase_actual.addEventListener('change', () => { form.fase_inicio.value = todayLocal(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = formValues(form);
    try { await patch(v); } catch (ex) { toast(ex.message); }
  });
  return h('section', { class: 'card' }, h('h3', { style: 'margin-bottom:16px' }, 'Proceso'), form);
}

function renderDatos(c) {
  const row = (k, val) => [h('dt', {}, k), h('dd', {}, val || '—')];
  return h('section', { class: 'card' },
    h('div', { class: 'spread', style: 'margin-bottom:16px' }, h('h3', {}, 'Datos'),
      h('button', { class: 'btn quiet', type: 'button', onclick: editDatos }, icon('edit'), 'Editar')),
    h('dl', { class: 'data' },
      ...row('Email', c.email ? h('a', { href: `mailto:${c.email}` }, c.email) : null),
      ...row('WhatsApp', c.whatsapp ? h('a', { href: waLink(c.whatsapp, ''), target: '_blank', rel: 'noopener' }, c.whatsapp) : null),
      ...row('Edad', c.edad),
      ...row('Ciudad', c.ciudad_pais),
      ...row('Rol', c.rol),
      ...row('Ingreso', c.fecha_ingreso ? fmtDate(c.fecha_ingreso) : null)));
}

function renderForms(c) {
  const items = rec.forms.map((f) => h('li', { style: 'padding:10px 0;border-bottom:1px solid var(--line)' },
    h('div', { class: 'spread' },
      h('span', {}, TIPOS_FORM[f.tipo] || f.tipo),
      f.respondido_at
        ? h('span', { class: 'small muted' }, `Respondido ${fmtIsoLocal(f.respondido_at)}`)
        : h('span', { class: 'pill line' }, 'Pendiente')),
    !f.respondido_at ? h('div', { class: 'row', style: 'margin-top:6px;gap:4px' },
      h('button', { class: 'btn quiet', type: 'button', onclick: () => copy(f.link) }, icon('copy'), 'Copiar'),
      h('a', { class: 'btn quiet', href: waLink(c.whatsapp, `Hola ${c.nombre.split(/\s+/)[0]}. Te comparto el formulario: ${f.link}`), target: '_blank', rel: 'noopener' }, icon('message'), 'WhatsApp'),
      h('button', { class: 'btn quiet danger', type: 'button', onclick: () => revokeForm(f.id) }, 'Anular')) : null));
  const hasIngreso = rec.forms.some((f) => f.tipo === 'ingreso');
  return h('section', { class: 'card' },
    h('h3', { style: 'margin-bottom:8px' }, 'Formularios'),
    items.length ? h('ul', { style: 'list-style:none;margin:0;padding:0' }, ...items) : h('p', { class: 'small muted' }, 'Sin formularios.'),
    !hasIngreso ? h('button', { class: 'btn', type: 'button', style: 'margin-top:12px', onclick: () => newFormLink('ingreso') }, icon('plus'), 'Generar link de ingreso') : null,
    h('h3', { style: 'margin:24px 0 8px' }, 'Kits de fase'),
    (rec.kits || []).length
      ? h('ul', { style: 'list-style:none;margin:0;padding:0' }, ...rec.kits.map((k) => h('li', { style: 'padding:10px 0;border-bottom:1px solid var(--line)' },
        h('div', { class: 'spread' }, h('a', { href: `/panel/kit?id=${enc(k.id)}` }, k.nombre), h('span', { class: 'small muted' }, kitEstado(k))),
        k.link ? h('div', { class: 'row', style: 'margin-top:6px;gap:4px' },
          h('button', { class: 'btn quiet', type: 'button', onclick: () => copy(k.link) }, icon('copy'), 'Copiar'),
          h('a', { class: 'btn quiet', href: waLink(c.whatsapp, `Hola ${c.nombre.split(/\s+/)[0]}. Te comparto el trabajo entre sesiones: ${k.link}`), target: '_blank', rel: 'noopener' }, icon('message'), 'WhatsApp'),
          k.estado === 'sin_empezar' ? h('button', { class: 'btn quiet danger', type: 'button', onclick: () => revokeKit(k.id) }, 'Anular') : null) : null)))
      : h('p', { class: 'small muted', style: 'margin:0' }, 'Todavía no hay kits.'),
    h('button', { class: 'btn', type: 'button', style: 'margin-top:12px', onclick: newKitLink }, icon('plus'), 'Generar link del kit'));
}

function renderTestigo() {
  const w = rec.witness.filter((x) => x.respondido_at || x.presencia != null);
  const ing = ingresoAnswers();
  const posible = ing?.data?.campos?.p23;
  const props = (rec.witness_proposals || []).filter((x) => x.estado !== 'descartado');
  return h('section', { class: 'card' },
    h('h3', { style: 'margin-bottom:12px' }, 'Testigo'),
    posible ? h('p', { class: 'voice', style: 'font-size:16px;margin:0 0 12px' }, posible) : null,
    ...props.map((x) => h('div', { style: 'border-top:1px solid var(--line);padding-top:10px;margin-bottom:12px' },
      h('div', { class: 'spread' }, h('span', { class: 'voice', style: 'font-size:17px' }, x.nombre || 'Sin nombre'),
        h('span', { class: x.estado === 'confirmado' ? 'pill' : 'pill line' }, x.estado === 'confirmado' ? 'Confirmado' : 'Propuesto, pendiente de confirmar')),
      x.motivo ? h('p', { class: 'voice', style: 'font-size:15.5px;margin:6px 0 0;color:var(--soft)' }, x.motivo) : null,
      x.estado === 'pendiente' ? h('div', { class: 'row', style: 'margin-top:6px;gap:4px' },
        h('button', { class: 'btn quiet', type: 'button', onclick: () => setProposal(x.id, 'confirmado') }, 'Confirmar'),
        h('button', { class: 'btn quiet', type: 'button', onclick: () => setProposal(x.id, 'descartado') }, 'Descartar')) : null)),
    w.length
      ? h('table', { class: 't' }, h('tbody', {}, ...w.map((x) => h('tr', {},
        h('td', {}, MOMENTOS.find((m) => m.key === x.momento)?.label || x.momento),
        h('td', { class: 'num' }, [x.presencia, x.dice_lo_que_piensa, x.calma_presion, x.eleccion_vs_obligacion].map((n) => n ?? '—').join(' · '))))))
      : h('p', { class: 'small muted', style: 'margin:0' }, 'El formulario del testigo llega en la Etapa 2.'));
}

function renderNotas(c) {
  const t = textarea('notas_generales', c.notas_generales, 'voice-input');
  t.style.minHeight = '140px';
  const btn = h('button', { class: 'btn', type: 'button', style: 'margin-top:12px', onclick: async () => {
    try { await patch({ notas_generales: t.value }, 'Notas guardadas.'); } catch (e) { toast(e.message); }
  } }, 'Guardar notas');
  return h('section', { class: 'card' }, h('label', { for: 'f_notas_generales' }, h('h3', { style: 'margin-bottom:12px' }, 'Notas generales')), t, btn);
}

function renderPrivacidad() {
  return h('section', { class: 'card' },
    h('h3', { style: 'margin-bottom:8px' }, 'Datos y privacidad'),
    h('p', { class: 'small muted', style: 'margin:0 0 12px' }, 'Derecho de acceso y supresión.'),
    h('div', { class: 'row', style: 'gap:8px' },
      h('a', { class: 'btn', href: `/api/admin/consultants/${enc(id)}/export` }, icon('download'), 'Exportar'),
      h('button', { class: 'btn danger', type: 'button', onclick: confirmDelete }, icon('trash'), 'Eliminar')));
}

function render() {
  const c = rec.consultant;
  document.title = `${c.nombre} · IRREEMPLAZABLE`;
  content.replaceChildren(
    renderHeader(c),
    renderCare(c) || '',
    renderArcon(),
    h('div', { class: 'grid' },
      h('div', { class: 'span-8' }, renderIndicadores(), renderTimeline(), renderIngreso() || ''),
      h('div', { class: 'span-4', style: 'display:flex;flex-direction:column;gap:16px;margin-top:32px' },
        renderProceso(c), renderDatos(c), renderForms(c), renderTestigo(), renderNotas(c), renderPrivacidad())),
  );
}

async function load() {
  if (!id) { errorBox(content, new Error('Falta indicar la consultante.')); return; }
  try {
    rec = await api(`/consultants/${enc(id)}`);
    render();
  } catch (e) {
    errorBox(content, e);
  }
}

load();
