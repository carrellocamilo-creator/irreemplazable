// IRREEMPLAZABLE · Renderer de kits de fase.
// Dibuja cualquier kit a partir de su definición (src/kits/*.json), guarda por sección en D1
// y mantiene un respaldo local en el navegador por si se cierra la pestaña.
(function () {
  'use strict';

  var TOKEN = new URLSearchParams(location.search).get('t') || '';
  var LS_KEY = 'irr-kit:' + TOKEN;
  var LS_LOCAL = 'irr-kit-local:' + TOKEN + ':';
  var MENTOR = 'Camilo';

  var state = {
    def: null,
    values: {},       // valor actual en pantalla
    server: {},       // último valor guardado en D1
    answeredAt: {},
    saved: {},        // sección -> fecha del último guardado
    fieldSection: {}, // campo -> sección
    dirty: {},        // sección -> true si hay cambios sin guardar
    pickers: [],
    sending: false,
  };

  // ---------- Utilidades ----------

  function el(tag, attrs) {
    var n = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v === true ? '' : v);
      }
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined || c === false) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) n.appendChild(x); });
      else n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return n;
  }
  function show(id) {
    ['loading', 'view', 'done', 'invalid', 'fallback'].forEach(function (x) {
      document.getElementById(x).style.display = x === id ? 'block' : 'none';
    });
    window.scrollTo(0, 0);
  }
  function lsGet(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; } }
  function lsSet(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  function lsDel(key) { try { localStorage.removeItem(key); } catch (e) { /* nada */ } }
  function fmtSaved(iso) {
    var d = new Date(iso);
    var day = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
    var time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
    return day + ', ' + time;
  }
  function api(path, body) {
    return fetch('/api/kit/' + encodeURIComponent(TOKEN) + path, body ? {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(body),
    } : { headers: { 'Accept': 'application/json' } });
  }

  // ---------- Respaldo local ----------

  function localDraft() { return lsGet(LS_KEY) || { values: {} }; }
  function storeLocal(key, value) {
    var d = localDraft();
    d.values[key] = { v: value, t: Date.now() };
    lsSet(LS_KEY, d);
  }
  function clearLocal(keys) {
    var d = localDraft();
    keys.forEach(function (k) { delete d.values[k]; });
    lsSet(LS_KEY, d);
  }

  // ---------- Campos ----------

  function setValue(key, value) {
    state.values[key] = value;
    storeLocal(key, value);
    var sec = state.fieldSection[key];
    if (sec) { state.dirty[sec] = (value !== (state.server[key] || '')) || hasDirty(sec); updateSaveState(sec); }
    if (/^d2_f/.test(key)) state.pickers.forEach(function (p) { p(); });
  }
  function hasDirty(sec) {
    for (var k in state.fieldSection) {
      if (state.fieldSection[k] === sec && (state.values[k] || '') !== (state.server[k] || '')) return true;
    }
    return false;
  }
  function val(key) { return state.values[key] || ''; }

  function fieldQ(label, hint, control, extra) {
    return el('div', { class: 'q' },
      label ? el('label', { class: 'qt', for: control.id, text: label }) : null,
      hint ? el('span', { class: 'hint', text: hint }) : null,
      control, extra || null);
  }

  function textInput(b) {
    var i = el('input', { type: 'text', id: 'f_' + b.key, placeholder: b.placeholder || null });
    i.value = val(b.key);
    i.addEventListener('input', function () { setValue(b.key, i.value); });
    return i;
  }
  function textArea(key, rows, cls) {
    var t = el('textarea', { id: 'f_' + key, class: cls || null });
    if (rows) t.style.minHeight = Math.max(64, rows * 30) + 'px';
    t.value = val(key);
    t.addEventListener('input', function () { setValue(key, t.value); });
    return t;
  }

  function scale(b) {
    var wrap = el('div', { class: 'scale' + (b.max <= 5 ? ' five' : ''), role: 'radiogroup', 'aria-label': b.label });
    for (var i = 1; i <= b.max; i++) {
      (function (n) {
        var id = 'f_' + b.key + '_' + n;
        var inp = el('input', { type: 'radio', name: b.key, id: id, value: String(n) });
        if (val(b.key) === String(n)) inp.checked = true;
        inp.addEventListener('change', function () { setValue(b.key, String(n)); });
        wrap.appendChild(inp);
        wrap.appendChild(el('label', { for: id, text: String(n) }));
      })(i);
    }
    var ends = b.ends ? el('div', { class: 'scale-ends' }, el('span', { text: b.ends[0] }), el('span', { text: b.ends[1] })) : null;
    return el('div', { class: 'q' }, el('span', { class: 'qt', text: b.label }), wrap, ends);
  }

  function yesno(b) {
    var reveal = el('div', { class: 'reveal' + (val(b.key) === 'Sí' ? ' on' : '') }, b.reveal.map(renderBlock));
    var wrap = el('div', { class: 'yn', role: 'radiogroup' });
    ['Sí', 'No'].forEach(function (v) {
      var id = 'f_' + b.key + '_' + (v === 'Sí' ? 'si' : 'no');
      var inp = el('input', { type: 'radio', name: b.key, id: id, value: v });
      if (val(b.key) === v) inp.checked = true;
      inp.addEventListener('change', function () {
        setValue(b.key, v);
        reveal.classList.toggle('on', v === 'Sí');
      });
      wrap.appendChild(inp);
      wrap.appendChild(el('label', { for: id, text: v }));
    });
    return el('div', { class: 'q' }, el('span', { class: 'qt', text: b.label }), wrap, reveal);
  }

  function lines(b) {
    var box = el('div', { class: 'lines' });
    for (var i = 1; i <= b.count; i++) {
      (function (n) {
        var key = b.key + '_' + n;
        var inp = el('input', { type: 'text', id: 'f_' + key, 'aria-label': b.label + ' (' + n + ')' });
        inp.value = val(key);
        inp.addEventListener('input', function () { setValue(key, inp.value); });
        box.appendChild(inp);
      })(i);
    }
    return el('div', { class: 'q' }, el('span', { class: 'qt', text: b.label }), box);
  }

  function columns(b) {
    var cols = b.cols.map(function (c, idx) {
      return el('div', null,
        el('p', { class: 'col-title' + (idx ? ' b' : ''), text: c.title }),
        b.rows.map(function (r) {
          var key = b.key + '_' + r.key + '_' + c.key;
          var t = textArea(key, 2);
          return el('div', { class: 'q', style: 'margin:0 0 14px' },
            el('label', { class: 'qt', for: t.id, style: 'font-size:17px', text: r.label }), t);
        }));
    });
    return el('div', { class: 'cols' }, cols);
  }

  function pick(b) {
    var box = el('div', { class: 'pick' });
    function current() { try { return JSON.parse(val(b.key) || '[]'); } catch (e) { return []; } }
    function render() {
      var chosen = current();
      box.textContent = '';
      var keys = Object.keys(state.fieldSection).filter(function (k) { return k.indexOf(b.from) === 0 && val(k).trim(); });
      if (!keys.length) { box.appendChild(el('p', { class: 'empty', text: 'Cuando escribas las frases, aparecen acá para marcar.' })); return; }
      keys.forEach(function (k) {
        var id = 'p_' + k;
        var inp = el('input', { type: 'checkbox', id: id });
        inp.checked = chosen.indexOf(k) !== -1;
        inp.disabled = !inp.checked && chosen.length >= b.max;
        inp.addEventListener('change', function () {
          var c = current().filter(function (x) { return x !== k; });
          if (inp.checked) c.push(k);
          setValue(b.key, c.length ? JSON.stringify(c.slice(0, b.max)) : '');
          render();
        });
        var n = k.match(/_f(\d+)_/);
        box.appendChild(el('label', { for: id }, inp, el('span', null, val(k), el('span', { class: 'src', text: n ? '  · frase ' + n[1] : '' }))));
      });
    }
    state.pickers.push(render);
    render();
    return el('div', { class: 'q' }, el('span', { class: 'qt', text: b.label }), box);
  }

  function rowsBlock(b) {
    var box = el('div', { class: 'rowsx' });
    var data;
    try { data = JSON.parse(val(b.key) || '[]'); } catch (e) { data = []; }
    while (data.length < (b.min_rows || 1)) data.push({});
    function commit() {
      var clean = data.filter(function (r) { return b.columns.some(function (c) { return (r[c.key] || '').trim(); }); });
      setValue(b.key, clean.length ? JSON.stringify(clean) : '');
    }
    function render() {
      box.textContent = '';
      box.appendChild(el('div', { class: 'hd' }, b.columns.map(function (c) { return el('span', { text: c.label }); }), el('span')));
      data.forEach(function (r, i) {
        var cells = b.columns.map(function (c) {
          var inp = el('input', { type: 'text', 'aria-label': c.label, placeholder: c.label });
          inp.value = r[c.key] || '';
          inp.addEventListener('input', function () { r[c.key] = inp.value; commit(); });
          return inp;
        });
        var rm = el('button', { type: 'button', class: 'linkbtn x', 'aria-label': 'Quitar fila', text: 'Quitar' });
        rm.addEventListener('click', function () { data.splice(i, 1); if (!data.length) data.push({}); commit(); render(); });
        box.appendChild(el('div', { class: 'r' }, cells, rm));
      });
      var add = el('button', { type: 'button', class: 'linkbtn', text: b.add_label || 'Agregar fila' });
      add.addEventListener('click', function () { data.push({}); render(); });
      box.appendChild(el('div', null, add));
    }
    render();
    return el('div', { class: 'q' }, b.hint ? el('span', { class: 'hint', text: b.hint }) : null, box);
  }

  // Campo que vive solo en este navegador: no se guarda en D1 ni se envía.
  function localOnly(b) {
    var key = LS_LOCAL + b.key;
    var t = el('textarea', { id: 'l_' + b.key, class: 'local', 'aria-label': b.label });
    t.style.minHeight = '180px';
    try { t.value = localStorage.getItem(key) || ''; } catch (e) { /* nada */ }
    t.addEventListener('input', function () { try { localStorage.setItem(key, t.value); } catch (e) { /* nada */ } });
    var del = el('button', { type: 'button', class: 'linkbtn', text: 'Borrar' });
    del.addEventListener('click', function () {
      if (!t.value || confirm('¿Borrar este texto? No se puede recuperar.')) { t.value = ''; try { localStorage.removeItem(key); } catch (e) { /* nada */ } }
    });
    return el('div', { class: 'q' }, t, el('div', { class: 'local-bar' }, el('span', { text: b.label }), del));
  }

  function renderBlock(b) {
    switch (b.type) {
      case 'p': return el('p', { class: b.style === 'note' ? 'note' : null, text: b.text });
      case 'list': return el('ul', { class: 'rules' }, b.items.map(function (x) { return el('li', { text: x }); }));
      case 'heading': return el('h3', { text: b.text });
      case 'text': return fieldQ(b.label, b.hint, textInput(b));
      case 'textarea': return fieldQ(b.label, b.hint, textArea(b.key, b.rows));
      case 'scale': return scale(b);
      case 'yesno': return yesno(b);
      case 'lines': return lines(b);
      case 'columns': return columns(b);
      case 'pick': return pick(b);
      case 'rows': return rowsBlock(b);
      case 'local': return localOnly(b);
      case 'deadline': return state.def.deadline_text ? el('p', { class: 'deadline', text: state.def.deadline_text + '.' }) : null;
      case 'signature': return el('p', { class: 'signature', text: state.def.firma || '' });
      default: return null;
    }
  }

  // Mismo recorrido que el servidor (src/kits/index.js · fieldsOf).
  function indexFields(def) {
    function walk(blocks, sec) {
      (blocks || []).forEach(function (b) {
        if (b.type === 'text' || b.type === 'textarea' || b.type === 'scale' || b.type === 'pick' || b.type === 'rows') state.fieldSection[b.key] = sec;
        if (b.type === 'yesno') { state.fieldSection[b.key] = sec; walk(b.reveal, sec); }
        if (b.type === 'lines') for (var i = 1; i <= b.count; i++) state.fieldSection[b.key + '_' + i] = sec;
        if (b.type === 'columns') b.rows.forEach(function (r) { b.cols.forEach(function (c) { state.fieldSection[b.key + '_' + r.key + '_' + c.key] = sec; }); });
      });
    }
    def.sections.forEach(function (s) { walk(s.blocks, s.key); });
  }

  // ---------- Secciones ----------

  var saveStates = {};
  function updateSaveState(sec) {
    var n = saveStates[sec];
    if (!n) return;
    n.classList.remove('err');
    if (state.dirty[sec]) n.textContent = state.saved[sec] ? 'Hay cambios sin guardar. Quedan en este dispositivo hasta que guardes.' : 'Sin guardar todavía. Se conserva en este dispositivo.';
    else n.textContent = state.saved[sec] ? 'Guardado · ' + fmtSaved(state.saved[sec]) : '';
    updateBar();
  }
  function updateBar() {
    var secs = state.def.sections.filter(function (s) { return s.save; });
    var done = secs.filter(function (s) { return state.saved[s.key]; }).length;
    document.getElementById('bar').style.width = (secs.length ? done / secs.length * 100 : 0) + '%';
  }

  function sectionValues(sec) {
    var out = {};
    for (var k in state.fieldSection) if (state.fieldSection[k] === sec) out[k] = state.values[k] || '';
    return out;
  }

  function saveSection(sec, btn) {
    var st = saveStates[sec];
    btn.disabled = true; btn.textContent = 'Guardando…';
    var values = sectionValues(sec);
    api('/save', { section: sec, values: values }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; });
    }).then(function (res) {
      btn.disabled = false; btn.textContent = 'Guardar este día';
      if (res.ok) {
        state.saved[sec] = res.j.saved_at || new Date().toISOString();
        Object.keys(values).forEach(function (k) { state.server[k] = values[k]; });
        clearLocal(Object.keys(values));
        state.dirty[sec] = false;
        updateSaveState(sec);
      } else if (res.status === 409 || res.status === 404) {
        load();
      } else {
        st.textContent = 'No se pudo guardar. Lo que escribiste sigue en este dispositivo; vuelve a intentar en un rato.';
        st.classList.add('err');
      }
    }).catch(function () {
      btn.disabled = false; btn.textContent = 'Guardar este día';
      st.textContent = 'Sin conexión. Lo que escribiste sigue en este dispositivo; vuelve a intentar cuando tengas señal.';
      st.classList.add('err');
    });
  }

  function careBlock(sec) {
    var pesado = state.def.sections.filter(function (s) { return s.key === (state.def.care && state.def.care.section); })[0];
    var paras = pesado ? pesado.blocks.filter(function (b) { return b.type === 'p'; }).map(function (b) { return el('p', { text: b.text }); }) : [];
    var status = el('p', { style: 'font-family:var(--sans);font-size:14.5px' });
    var box = el('div', { class: 'carebox', role: 'status' }, status, paras,
      pesado && pesado.key !== sec ? el('p', null, el('a', { href: '#s_' + pesado.key, text: 'Ir a “' + pesado.title + '”' })) : null);
    var id = 'care_' + sec;
    var inp = el('input', { type: 'checkbox', id: id });
    inp.addEventListener('change', function () {
      if (!inp.checked) { box.classList.remove('on'); return; }
      box.classList.add('on');
      status.textContent = 'Registrando…';
      api('/care', { section: sec }).then(function (r) {
        status.textContent = r.ok ? 'Quedó registrado. Lo voy a ver.' : 'No se pudo registrar. Escríbeme directamente por WhatsApp.';
      }).catch(function () { status.textContent = 'Sin conexión. Escríbeme directamente por WhatsApp.'; });
    });
    var label = (state.def.care && state.def.care.label) || 'Necesito hablar';
    return [el('div', { class: 'carecheck' }, el('label', { class: 'check', for: id }, inp, el('span', { text: label }))), box];
  }

  function renderSection(s, n) {
    var sec = el('section', { id: 's_' + s.key },
      el('div', { class: 'sec-head' }, el('span', { class: 'sec-num', text: String(n) }), el('h2', { text: s.title })),
      s.subtitle ? el('p', { class: 'sec-sub', text: s.subtitle }) : null,
      s.meta ? el('p', { class: 'sec-meta', text: s.meta }) : null,
      s.intro ? el('p', { class: 'sec-intro', style: 'margin-top:14px', text: s.intro }) : null,
      el('div', { class: 'sec-body' }, s.blocks.map(renderBlock)));

    if (s.save) {
      var btn = el('button', { type: 'button', text: 'Guardar este día' });
      btn.addEventListener('click', function () { saveSection(s.key, btn); });
      var st = el('span', { class: 'savestate', 'aria-live': 'polite' });
      saveStates[s.key] = st;
      sec.appendChild(el('div', { class: 'savebar' }, btn, st));
    }
    if (s.final) {
      var send = el('button', { type: 'button', id: 'sendBtn', text: 'Entregar el trabajo' });
      send.addEventListener('click', deliver);
      sec.appendChild(el('div', { class: 'actions' }, send, el('p', { class: 'form-msg', id: 'formMsg', role: 'alert' })));
    }
    careBlock(s.key).forEach(function (x) { sec.appendChild(x); });
    return sec;
  }

  function render(data) {
    var def = state.def = data.kit;
    indexFields(def);
    state.server = data.answers || {};
    state.answeredAt = data.answered_at || {};
    state.saved = data.saved || {};
    state.values = {};
    for (var k in state.server) state.values[k] = state.server[k];

    // Respaldo local más nuevo que lo guardado en D1.
    var local = localDraft().values || {};
    for (var key in local) {
      if (!(key in state.fieldSection)) continue;
      var serverT = state.answeredAt[key] ? Date.parse(state.answeredAt[key]) : 0;
      if (local[key].t > serverT && local[key].v !== (state.server[key] || '')) state.values[key] = local[key].v;
    }

    document.title = 'IRREEMPLAZABLE · ' + def.title;
    document.getElementById('title').textContent = def.title;
    document.getElementById('subtitle').textContent = def.subtitle || '';
    var intro = document.getElementById('intro');
    intro.textContent = '';
    (def.intro || '').split(/\n+/).filter(Boolean).forEach(function (p) { intro.appendChild(el('p', { class: 'lead', text: p })); });

    var box = document.getElementById('sections');
    box.textContent = '';
    state.pickers = [];
    saveStates = {};
    def.sections.forEach(function (s, i) { box.appendChild(renderSection(s, i + 1)); });
    def.sections.forEach(function (s) { if (s.save) { state.dirty[s.key] = hasDirty(s.key); updateSaveState(s.key); } });
    updateBar();
    show('view');
  }

  // ---------- Entrega y respaldo ----------

  function asText() {
    var def = state.def;
    var out = ['IRREEMPLAZABLE · ' + def.title, def.subtitle || '', ''];
    function walk(blocks) {
      (blocks || []).forEach(function (b) {
        if (b.type === 'heading') out.push('— ' + b.text);
        if ((b.type === 'text' || b.type === 'textarea' || b.type === 'scale' || b.type === 'yesno') && val(b.key)) { out.push(b.label + ':'); out.push(val(b.key)); out.push(''); }
        if (b.type === 'yesno') walk(b.reveal);
        if (b.type === 'lines') {
          var ls = [];
          for (var i = 1; i <= b.count; i++) if (val(b.key + '_' + i)) ls.push('- ' + val(b.key + '_' + i));
          if (ls.length) { out.push(b.label); out = out.concat(ls); out.push(''); }
        }
        if (b.type === 'columns') b.cols.forEach(function (c) {
          b.rows.forEach(function (r) { var v = val(b.key + '_' + r.key + '_' + c.key); if (v) { out.push(c.title + ' · ' + r.label + ':'); out.push(v); out.push(''); } });
        });
        if (b.type === 'rows' && val(b.key)) {
          try { JSON.parse(val(b.key)).forEach(function (r) { out.push(b.columns.map(function (c) { return r[c.key] || ''; }).join(' · ')); }); out.push(''); } catch (e) { /* nada */ }
        }
      });
    }
    def.sections.forEach(function (s) {
      var before = out.length;
      out.push('## ' + s.title);
      walk(s.blocks);
      if (out.length === before + 1) out.pop(); else out.push('');
    });
    return out.join('\n');
  }
  function download() {
    var blob = new Blob([asText()], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'irreemplazable-' + (state.def.key || 'kit') + '.txt';
    document.body.appendChild(a); a.click(); a.remove();
  }

  function clearAllLocal() {
    lsDel(LS_KEY);
    try {
      Object.keys(localStorage).forEach(function (k) { if (k.indexOf(LS_LOCAL) === 0) localStorage.removeItem(k); });
    } catch (e) { /* nada */ }
  }

  function deliver() {
    if (state.sending) return;
    var btn = document.getElementById('sendBtn');
    var msg = document.getElementById('formMsg');
    msg.textContent = '';
    state.sending = true; btn.disabled = true; btn.textContent = 'Enviando…';
    var values = {};
    for (var k in state.fieldSection) values[k] = state.values[k] || '';
    api('/deliver', { values: values }).then(function (r) {
      state.sending = false; btn.disabled = false; btn.textContent = 'Entregar el trabajo';
      if (r.ok) { clearAllLocal(); showDone(state.def.cierre); }
      else if (r.status === 409) load();
      else if (r.status === 404) show('invalid');
      else show('fallback');
    }).catch(function () {
      state.sending = false; btn.disabled = false; btn.textContent = 'Entregar el trabajo';
      show('fallback');
    });
  }

  function showDone(c) {
    c = c || {};
    document.getElementById('doneTitle').textContent = c.title || 'Entregado.';
    document.getElementById('doneSecond').textContent = c.second || '';
    document.getElementById('doneLead').textContent = c.lead || '';
    document.getElementById('bar').style.width = '100%';
    show('done');
  }

  document.getElementById('dlBtn').addEventListener('click', download);
  document.getElementById('copyBtn').addEventListener('click', function () {
    var m = document.getElementById('copyMsg');
    if (navigator.clipboard) navigator.clipboard.writeText(asText()).then(function () { m.textContent = 'Copiado. Pégalo en un mensaje para ' + MENTOR + '.'; }, function () { m.textContent = 'No se pudo copiar. Usa "Descargar respuestas".'; });
    else m.textContent = 'No se pudo copiar. Usa "Descargar respuestas".';
  });
  document.getElementById('backBtn').addEventListener('click', function () { show('view'); });

  // ---------- Carga ----------

  function load() {
    if (!TOKEN) { show('invalid'); return; }
    api('').then(function (r) {
      if (r.status === 404) { show('invalid'); return null; }
      if (!r.ok) throw new Error('error');
      return r.json();
    }).then(function (data) {
      if (!data) return;
      if (data.estado === 'entregado') { clearAllLocal(); showDone(data.kit && data.kit.cierre); return; }
      render(data);
    }).catch(function () {
      var l = document.getElementById('loading');
      l.textContent = 'No se pudo cargar el trabajo. Revisa la conexión y vuelve a abrir el link.';
      show('loading');
    });
  }

  load();
})();
