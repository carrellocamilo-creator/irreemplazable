// Registro de kits de fase. Cada kit es un archivo de datos: agregar un kit nuevo
// es sumar su JSON acá, sin tocar el renderer ni la API.
import fase1 from './fase1-las-dos-vidas.json';

export const KITS = {
  [fase1.key]: fase1,
};

export function getKit(key) {
  return KITS[key] || null;
}

// Valores de personalización: los del kit por defecto, pisados por los de la consultante.
export function resolveVars(kit, config = {}) {
  const vars = {};
  for (const [k, v] of Object.entries(kit.vars || {})) vars[k] = v.default ?? '';
  for (const [k, v] of Object.entries(config.vars || {})) {
    if (k in vars && typeof v === 'string') vars[k] = v;
  }
  return vars;
}

// Todos los campos que se guardan en D1 (los "local" quedan solo en el navegador).
export function fieldsOf(kit) {
  const out = {};
  const walk = (blocks, section) => {
    for (const b of blocks || []) {
      switch (b.type) {
        case 'text': case 'textarea': out[b.key] = { type: 'text', section }; break;
        case 'yesno': out[b.key] = { type: 'yesno', section }; walk(b.reveal, section); break;
        case 'scale': out[b.key] = { type: 'scale', max: b.max, section }; break;
        case 'lines':
          for (let i = 1; i <= b.count; i++) out[`${b.key}_${i}`] = { type: 'text', section };
          break;
        case 'columns':
          for (const r of b.rows) for (const c of b.cols) out[`${b.key}_${r.key}_${c.key}`] = { type: 'text', section };
          break;
        case 'pick': out[b.key] = { type: 'json', section }; break;
        case 'rows': out[b.key] = { type: 'json', section }; break;
        default: break;
      }
    }
  };
  for (const s of kit.sections) walk(s.blocks, s.key);
  return out;
}

export function kitList() {
  return Object.values(KITS).map((k) => ({ key: k.key, nombre: k.nombre_panel, fase: k.fase, vars: k.vars }));
}
