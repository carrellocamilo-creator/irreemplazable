// Gráficos en SVG, sin librerías. Muestran trayectoria, nunca calificación.

const NS = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}, text) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text !== undefined) el.textContent = text;
  return el;
}

// ARCON: una dimensión. moments = [{key, short}], consultant/mentor = {momentKey: valor}
export function arconChart({ moments, consultant, mentor, title }) {
  const W = 200, H = 150, L = 18, R = 8, T = 8, B = 22;
  const iw = W - L - R, ih = H - T - B;
  const x = (i) => L + (moments.length === 1 ? iw / 2 : (i * iw) / (moments.length - 1));
  const y = (v) => T + ih - ((v - 1) / 4) * ih;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': title });

  for (let v = 1; v <= 5; v++) {
    svg.append(s('line', { class: 'axis', x1: L, x2: W - R, y1: y(v), y2: y(v), 'stroke-opacity': v === 1 ? 1 : 0.5 }));
    svg.append(s('text', { class: 'tick', x: L - 6, y: y(v) + 3, 'text-anchor': 'end' }, String(v)));
  }
  moments.forEach((m, i) => svg.append(s('text', { class: 'tick', x: x(i), y: H - 4, 'text-anchor': 'middle' }, m.short)));

  // Brecha consultante–mentor sombreada en líquen.
  const both = moments.map((m, i) => ({ i, c: consultant[m.key], m: mentor[m.key] }));
  for (let k = 0; k < both.length - 1; k++) {
    const a = both[k], b = both[k + 1];
    if ([a.c, a.m, b.c, b.m].every((v) => v != null)) {
      svg.append(s('polygon', { class: 'gap', points: `${x(a.i)},${y(a.c)} ${x(b.i)},${y(b.c)} ${x(b.i)},${y(b.m)} ${x(a.i)},${y(a.m)}` }));
    }
  }
  for (const p of both) {
    if (p.c != null && p.m != null && p.c !== p.m) {
      svg.append(s('line', { x1: x(p.i), x2: x(p.i), y1: y(p.c), y2: y(p.m), stroke: 'var(--lichen)', 'stroke-width': 4 }));
    }
  }

  const series = (vals, lineCls, dotCls) => {
    const pts = moments.map((m, i) => (vals[m.key] != null ? [x(i), y(vals[m.key])] : null));
    let d = '', pen = false;
    for (const p of pts) {
      if (!p) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${p[0]},${p[1]} `;
      pen = true;
    }
    if (d) svg.append(s('path', { class: lineCls, d }));
    pts.forEach((p) => p && svg.append(s('circle', { class: dotCls, cx: p[0], cy: p[1], r: 2.6 })));
  };
  series(mentor, 'l-m', 'd-m');
  series(consultant, 'l-c', 'd-c');
  return svg;
}

// Indicador 1–10 en el tiempo. points = [{fecha, valor}]
export function lineChart({ points, title, min = 1, max = 10 }) {
  const W = 260, H = 130, L = 20, R = 8, T = 8, B = 20;
  const iw = W - L - R, ih = H - T - B;
  const n = points.length;
  const x = (i) => L + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v) => T + ih - ((v - min) / (max - min)) * ih;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': title });
  for (const v of [1, 5, 10]) {
    svg.append(s('line', { class: 'axis', x1: L, x2: W - R, y1: y(v), y2: y(v), 'stroke-opacity': v === 1 ? 1 : 0.5 }));
    svg.append(s('text', { class: 'tick', x: L - 6, y: y(v) + 3, 'text-anchor': 'end' }, String(v)));
  }
  if (n) {
    const first = points[0].fecha, last = points[n - 1].fecha;
    svg.append(s('text', { class: 'tick', x: L, y: H - 4, 'text-anchor': 'start' }, short(first)));
    if (n > 1) svg.append(s('text', { class: 'tick', x: W - R, y: H - 4, 'text-anchor': 'end' }, short(last)));
    let d = '';
    points.forEach((p, i) => { d += `${i ? 'L' : 'M'}${x(i)},${y(p.valor)} `; });
    svg.append(s('path', { class: 'l-c', d }));
    points.forEach((p, i) => svg.append(s('circle', { class: 'd-c', cx: x(i), cy: y(p.valor), r: 2.6 })));
  }
  return svg;
}

function short(fecha) {
  const [, m, d] = fecha.split('-');
  return `${Number(d)}/${Number(m)}`;
}
