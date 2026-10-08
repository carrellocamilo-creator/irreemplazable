// IRREEMPLAZABLE · Estructura del método traducida a la app.
// Fuente de verdad conceptual: el manual del método. Si el manual cambia, se cambia acá.

export const FASES = {
  0: 'Diagnóstico',            // [PENDIENTE: confirmar con el manual]
  1: 'Fase 1',                 // [PENDIENTE: nombre según el manual]
  2: 'Fase 2',                 // [PENDIENTE]
  3: 'Desprogramar lo heredado',
  4: 'Fase 4',                 // [PENDIENTE]
  5: 'Fase 5',                 // [PENDIENTE]
  6: 'Fase 6',                 // [PENDIENTE]
};

export function faseLabel(n) {
  if (n === null || n === undefined) return '';
  const name = FASES[n];
  if (n === 0) return `Fase 0 · ${name}`;
  return name && name !== `Fase ${n}` ? `Fase ${n} · ${name}` : `Fase ${n}`;
}

export const CICLO_DIAS = 14;

export const ESTADOS = {
  aplicacion: 'Aplicación',
  diagnostico: 'Diagnóstico',
  activo: 'Activo',
  pausado: 'Pausado',
  cerrado: 'Cerrado',
  sosten90: 'Sostén 90 días',
};

export const REGISTROS = { claro: 'Claro', profundo: 'Profundo' };

export const ARCON_DIMS = [
  { key: 'autenticidad', letra: 'A', label: 'Autenticidad', pregunta: '¿Actúo desde mí o en automático?', ends: ['Automático', 'Desde mí'] },
  { key: 'resonancia', letra: 'R', label: 'Resonancia', pregunta: '¿Siento en el cuerpo lo que vivo?', ends: ['Anestesia', 'Lo registro'] },
  { key: 'coherencia', letra: 'C', label: 'Coherencia', pregunta: '¿Lo que pienso, siento y hago va en la misma dirección?', ends: ['Para lados distintos', 'Alineado'] },
  { key: 'observacion', letra: 'O', label: 'Observación', pregunta: '¿Puedo observarme sin juzgarme ni justificarme?', ends: ['Me juzgo', 'Me veo claro'] },
  { key: 'narrativa', letra: 'N', label: 'Narrativa', pregunta: '¿Mi historia me pasa o yo elijo cómo sigue?', ends: ['Me pasa', 'La elijo'] },
];

// Los 8 momentos del eje X del gráfico ARCON. Los de kit y sostén aparecen solo si tienen datos.
export const MOMENTOS = [
  { key: 'sesion0', label: 'Sesión 0', short: 'S0' },
  { key: 'kit_f1', label: 'Fase 1 · kit', short: 'K1', kit: true },
  { key: 'fin_f1', label: 'Fin fase 1', short: 'F1' },
  { key: 'kit_f2', label: 'Fase 2 · kit', short: 'K2', kit: true },
  { key: 'fin_f2', label: 'Fin fase 2', short: 'F2' },
  { key: 'kit_f3', label: 'Fase 3 · kit', short: 'K3', kit: true },
  { key: 'fin_f3', label: 'Fin fase 3', short: 'F3' },
  { key: 'kit_f4', label: 'Fase 4 · kit', short: 'K4', kit: true },
  { key: 'fin_f4', label: 'Fin fase 4', short: 'F4' },
  { key: 'kit_f5', label: 'Fase 5 · kit', short: 'K5', kit: true },
  { key: 'fin_f5', label: 'Fin fase 5', short: 'F5' },
  { key: 'kit_f6', label: 'Fase 6 · kit', short: 'K6', kit: true },
  { key: 'fin_f6', label: 'Fin fase 6', short: 'F6' },
  { key: 'final', label: 'Final', short: 'Fin' },
  { key: 'sosten30', label: 'Sostén 30 días', short: '+30', sosten: true },
  { key: 'sosten60', label: 'Sostén 60 días', short: '+60', sosten: true },
  { key: 'sosten90', label: 'Sostén 90 días', short: '+90', sosten: true },
];

export const INDICADORES = [
  { key: 'sueno', label: 'Sueño', ends: ['Muy mala', 'Excelente'] },
  { key: 'energia', label: 'Energía', ends: ['Agotada', 'Plena'] },
  { key: 'intensidad_sintoma', label: 'Intensidad del malestar', ends: ['Leve', 'Muy intenso'] },
  { key: 'vida_propia', label: 'Vida propia', ends: ['Prestada', 'Totalmente mía'] },
];

export const SEMAFORO = { verde: 'Verde', amarillo: 'Amarillo', rojo: 'Rojo' };
export const INTENSIDAD = { baja: 'Baja', media: 'Media', alta: 'Alta' };
export const CUMPLIO = { si: 'Sí', parcial: 'En parte', no: 'No' };

export const TIPOS_ACTO = {
  no: 'Un no',
  limite: 'Un límite',
  pedido: 'Un pedido',
  conversacion: 'Una conversación',
  decision: 'Una decisión',
};

export const TIPOS_FORM = {
  ingreso: 'Ingreso',
  diagnostico_fase_1: 'Diagnóstico fase 1',
  diagnostico_fase_2: 'Diagnóstico fase 2',
  diagnostico_fase_3: 'Diagnóstico fase 3',
  diagnostico_fase_4: 'Diagnóstico fase 4',
  diagnostico_fase_5: 'Diagnóstico fase 5',
  diagnostico_fase_6: 'Diagnóstico fase 6',
  bitacora: 'Bitácora',
  cierre: 'Cierre',
};

// Estructura 1:1 de la sesión.
export const ESTRUCTURA_SESION = [
  { key: 'apertura', label: 'Apertura' },
  { key: 'exploracion', label: 'Exploración' },
  { key: 'intervencion', label: 'Intervención' },
  { key: 'integracion', label: 'Integración' },
  { key: 'compromiso', label: 'Compromiso' },
];
