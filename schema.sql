CREATE TABLE IF NOT EXISTS consultants (
  id               TEXT PRIMARY KEY,
  nombre           TEXT NOT NULL,
  email            TEXT,
  whatsapp         TEXT,
  edad             INTEGER,
  ciudad_pais      TEXT,
  rol              TEXT,
  fecha_ingreso    TEXT,
  estado           TEXT NOT NULL DEFAULT 'aplicacion'
                   CHECK (estado IN ('aplicacion','diagnostico','activo','pausado','cerrado','sosten90')),
  fase_actual      INTEGER NOT NULL DEFAULT 0 CHECK (fase_actual BETWEEN 0 AND 6),
  fase_inicio      TEXT,
  proxima_sesion   TEXT,
  registro         TEXT CHECK (registro IN ('claro','profundo')),
  alerta_cuidado   INTEGER NOT NULL DEFAULT 0 CHECK (alerta_cuidado IN (0,1)),
  notas_generales  TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS forms (
  id               TEXT PRIMARY KEY,
  consultant_id    TEXT NOT NULL REFERENCES consultants(id) ON DELETE CASCADE,
  tipo             TEXT NOT NULL CHECK (tipo IN (
                     'ingreso',
                     'diagnostico_fase_1','diagnostico_fase_2','diagnostico_fase_3',
                     'diagnostico_fase_4','diagnostico_fase_5','diagnostico_fase_6',
                     'bitacora','cierre')),
  token            TEXT NOT NULL UNIQUE,
  enviado_at       TEXT,
  respondido_at    TEXT,
  respuestas_json  TEXT
);
CREATE INDEX IF NOT EXISTS idx_forms_consultant ON forms(consultant_id);
CREATE TABLE IF NOT EXISTS arcon (
  id               TEXT PRIMARY KEY,
  consultant_id    TEXT NOT NULL REFERENCES consultants(id) ON DELETE CASCADE,
  momento          TEXT NOT NULL CHECK (momento IN (
                     'sesion0','fin_f1','fin_f2','fin_f3','fin_f4','fin_f5','fin_f6',
                     'final','sosten30','sosten60','sosten90')),
  quien            TEXT NOT NULL CHECK (quien IN ('consultante','mentor')),
  autenticidad     INTEGER CHECK (autenticidad BETWEEN 1 AND 5),
  resonancia       INTEGER CHECK (resonancia BETWEEN 1 AND 5),
  coherencia       INTEGER CHECK (coherencia BETWEEN 1 AND 5),
  observacion      INTEGER CHECK (observacion BETWEEN 1 AND 5),
  narrativa        INTEGER CHECK (narrativa BETWEEN 1 AND 5),
  fecha            TEXT NOT NULL,
  UNIQUE (consultant_id, momento, quien)
);
CREATE TABLE IF NOT EXISTS indicators (
  id                  TEXT PRIMARY KEY,
  consultant_id       TEXT NOT NULL REFERENCES consultants(id) ON DELETE CASCADE,
  fecha               TEXT NOT NULL,
  sueno               INTEGER CHECK (sueno BETWEEN 1 AND 10),
  energia             INTEGER CHECK (energia BETWEEN 1 AND 10),
  intensidad_sintoma  INTEGER CHECK (intensidad_sintoma BETWEEN 1 AND 10),
  vida_propia         INTEGER CHECK (vida_propia BETWEEN 1 AND 10),
  sintoma_descripcion TEXT
);
CREATE INDEX IF NOT EXISTS idx_indicators_consultant ON indicators(consultant_id, fecha);
CREATE TABLE IF NOT EXISTS sessions (
  id                          TEXT PRIMARY KEY,
  consultant_id               TEXT NOT NULL REFERENCES consultants(id) ON DELETE CASCADE,
  fecha                       TEXT NOT NULL,
  numero                      INTEGER,
  fase                        INTEGER CHECK (fase BETWEEN 0 AND 6),
  semaforo                    TEXT CHECK (semaforo IN ('verde','amarillo','rojo')),
  como_llega                  TEXT,
  tecnica_usada               TEXT,
  intensidad                  TEXT CHECK (intensidad IN ('baja','media','alta')),
  notas_mentor                TEXT,
  lo_que_se_lleva             TEXT,
  compromiso_semana           TEXT,
  cumplio_compromiso_anterior TEXT CHECK (cumplio_compromiso_anterior IN ('si','parcial','no'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_consultant ON sessions(consultant_id, fecha);
CREATE TABLE IF NOT EXISTS identity_acts (
  id               TEXT PRIMARY KEY,
  consultant_id    TEXT NOT NULL REFERENCES consultants(id) ON DELETE CASCADE,
  fecha            TEXT NOT NULL,
  fase             INTEGER CHECK (fase BETWEEN 0 AND 6),
  descripcion      TEXT NOT NULL,
  tipo             TEXT CHECK (tipo IN ('no','limite','pedido','conversacion','decision'))
);
CREATE INDEX IF NOT EXISTS idx_acts_consultant ON identity_acts(consultant_id, fecha);
CREATE TABLE IF NOT EXISTS witness (
  id                      TEXT PRIMARY KEY,
  consultant_id           TEXT NOT NULL REFERENCES consultants(id) ON DELETE CASCADE,
  momento                 TEXT NOT NULL CHECK (momento IN ('sesion0','fin_f3','final')),
  presencia               INTEGER CHECK (presencia BETWEEN 1 AND 5),
  dice_lo_que_piensa      INTEGER CHECK (dice_lo_que_piensa BETWEEN 1 AND 5),
  calma_presion           INTEGER CHECK (calma_presion BETWEEN 1 AND 5),
  eleccion_vs_obligacion  INTEGER CHECK (eleccion_vs_obligacion BETWEEN 1 AND 5),
  cambio_concreto         TEXT,
  token                   TEXT UNIQUE,
  respondido_at           TEXT
);
CREATE INDEX IF NOT EXISTS idx_witness_consultant ON witness(consultant_id);
CREATE TABLE IF NOT EXISTS checkins (
  id               TEXT PRIMARY KEY,
  consultant_id    TEXT NOT NULL REFERENCES consultants(id) ON DELETE CASCADE,
  semana           INTEGER,
  fecha            TEXT NOT NULL,
  texto            TEXT
);
CREATE INDEX IF NOT EXISTS idx_checkins_consultant ON checkins(consultant_id, fecha);
CREATE TABLE IF NOT EXISTS ai_analyses (
  id                 TEXT PRIMARY KEY,
  consultant_id      TEXT NOT NULL REFERENCES consultants(id) ON DELETE CASCADE,
  tipo               TEXT NOT NULL CHECK (tipo IN ('preparar_sesion','evolucion','cierre_fase')),
  input_anonimizado  TEXT,
  output             TEXT,
  fecha              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_consultant ON ai_analyses(consultant_id);
