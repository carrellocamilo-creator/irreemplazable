import { api, h, icon, copy, shell, fmtIsoLocal, errorBox, waLink } from './ui.js';

shell('panel');

const id = new URLSearchParams(location.search).get('id');
const content = document.getElementById('content');
const enc = encodeURIComponent;

const ESTADO = { sin_empezar: 'Sin empezar', en_curso: 'En curso', entregado: 'Entregado' };

function fmtAt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${fmtIsoLocal(iso)} · ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

function render(data) {
  const { kit, definition: def, answers, events, consultant, estado } = data;
  const byKey = new Map(answers.map((a) => [a.field_key, a]));
  const cur = (k) => { const a = byKey.get(k); return a ? (a.final_at ? a.respuesta_final ?? '' : a.primera_respuesta ?? '') : ''; };
  let diffCount = 0;

  function answer(label, key, fmt = (x) => x) {
    const a = byKey.get(key);
    if (!a) return null;
    const body = !a
      ? h('div', { class: 'a empty-a' }, 'Sin respuesta')
      : a.final_at
        ? h('div', { class: 'versions' },
          h('div', { class: 'v' }, h('div', { class: 'v-head' }, `Primera respuesta · ${fmtAt(a.primera_at)}`), h('div', { class: 'a' }, fmt(a.primera_respuesta) || '—')),
          h('div', { class: 'v final' }, h('div', { class: 'v-head' }, `Corregida · ${fmtAt(a.final_at)}`),
            a.respuesta_final ? h('div', { class: 'a' }, fmt(a.respuesta_final)) : h('div', { class: 'a empty-a' }, 'La borró')))
        : h('div', { class: 'a' }, fmt(a.primera_respuesta));
    if (a && a.final_at) diffCount++;
    return h('div', { class: 'ans' },
      h('div', { class: 'q-label' }, label, a && a.final_at ? h('span', { class: 'diff-tag' }, 'cambió') : null), body);
  }

  const fmtRows = (cols) => (v) => {
    try { return JSON.parse(v).map((r) => cols.map((c) => r[c.key] || '—').join(' · ')).join('\n'); } catch { return v; }
  };
  const fmtPick = (v) => {
    try { return JSON.parse(v).map((k) => `“${cur(k)}”`).join('\n'); } catch { return v; }
  };

  function blocks(list) {
    const out = [];
    for (const b of list || []) {
      switch (b.type) {
        case 'heading': out.push(h('h3', { 'data-major': '1' }, b.text)); break;
        case 'text': case 'textarea': out.push(answer(b.label, b.key)); break;
        case 'scale': out.push(answer(b.label, b.key, (x) => (x ? `${x} de ${b.max}` : x))); break;
        case 'yesno':
          out.push(answer(b.label, b.key));
          if (cur(b.key) === 'Sí' || b.reveal.some((r) => byKey.has(r.key))) out.push(...blocks(b.reveal));
          break;
        case 'lines':
          out.push(h('h3', {}, b.label));
          for (let i = 1; i <= b.count; i++) if (byKey.has(`${b.key}_${i}`)) out.push(answer(`${i}`, `${b.key}_${i}`));
          break;
        case 'columns':
          for (const c of b.cols) {
            out.push(h('h3', {}, c.title));
            for (const r of b.rows) out.push(answer(r.label, `${b.key}_${r.key}_${c.key}`));
          }
          break;
        case 'pick': out.push(answer(b.label, b.key, fmtPick)); break;
        case 'rows': out.push(answer(b.columns.map((c) => c.label).join(' · '), b.key, fmtRows(b.columns))); break;
        default: break;
      }
    }
    // Sin campos vacíos ni títulos que quedan sin respuestas debajo.
    const items = out.filter(Boolean);
    const isH = (n) => n.tagName === 'H3';
    return items.filter((n, i) => {
      if (!isH(n)) return true;
      for (let j = i + 1; j < items.length; j++) {
        if (!isH(items[j])) return true;
        if (n.dataset.major ? items[j].dataset.major : true) return false;
      }
      return false;
    });
  }

  const savedBySection = {};
  for (const e of events) if (e.tipo === 'guardado') (savedBySection[e.section_key] ||= []).push(e.at);
  const cuidados = events.filter((e) => e.tipo === 'cuidado');

  const sections = def.sections.filter((s) => s.save).map((s) => {
    const saved = savedBySection[s.key] || [];
    const content = blocks(s.blocks);
    const state = saved.length
      ? `Guardado ${saved.length === 1 ? 'una vez' : `${saved.length} veces`}, la última ${fmtAt(saved[saved.length - 1])}`
      : content.length && kit.entregado_at ? 'Completado al entregar' : 'Sin guardar';
    return h('section', { class: 'card kit-sec' },
      h('h2', {}, s.title),
      h('p', { class: 'kit-sub' }, [s.subtitle, state].filter(Boolean).join(' · ')),
      ...(content.length ? content : [h('p', { class: 'empty' }, 'Sin respuestas en esta parte.')]));
  });

  document.title = `${def.title} · ${consultant.nombre}`;
  content.replaceChildren(
    h('a', { class: 'back', href: `/panel/consultante?id=${enc(consultant.id)}` }, icon('back'), consultant.nombre),
    h('div', { class: 'page-head' },
      h('div', {},
        h('h1', {}, `Kit · ${def.title}`),
        h('div', { class: 'row', style: 'margin-top:12px' },
          h('span', { class: estado === 'entregado' ? 'pill' : 'pill line' }, ESTADO[estado]),
          h('span', { class: 'small muted' }, `Creado ${fmtIsoLocal(kit.created_at)}`),
          kit.entregado_at ? h('span', { class: 'small muted' }, `Entregado ${fmtAt(kit.entregado_at)}`) : null,
          diffCount ? h('span', { class: 'small muted' }, `${diffCount} ${diffCount === 1 ? 'respuesta corregida' : 'respuestas corregidas'}`) : null)),
      kit.link ? h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onclick: () => copy(kit.link) }, icon('copy'), 'Copiar link'),
        h('a', { class: 'btn', href: waLink('', `Te comparto el trabajo entre sesiones: ${kit.link}`), target: '_blank', rel: 'noopener' }, icon('message'), 'WhatsApp')) : null),
    ...cuidados.map((e) => h('div', { class: 'care-band', role: 'alert', style: 'margin-bottom:8px' },
      h('div', { class: 'row', style: 'flex-wrap:nowrap;align-items:flex-start' }, icon('alert', 'i icon-alert'),
        h('p', { class: 'voice' }, `Marcó “necesito hablar” el ${fmtAt(e.at)}.`)))),
    h('p', { class: 'small muted', style: 'margin:16px 0 0' }, 'Cuando una respuesta cambió, se muestran la primera y la corregida. La diferencia es material de trabajo.'),
    ...sections,
  );
}

async function load() {
  if (!id) { errorBox(content, new Error('Falta indicar el kit.')); return; }
  try { render(await api(`/kits/${enc(id)}`)); } catch (e) { errorBox(content, e); }
}

load();
