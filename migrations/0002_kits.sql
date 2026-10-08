CREATE TABLE IF NOT EXISTS kits (
  id               TEXT PRIMARY KEY,
  consultant_id    TEXT NOT NULL REFERENCES consultants(id) ON DELETE CASCADE,
  kit_key          TEXT NOT NULL,
  fase             INTEGER CHECK (fase BETWEEN 0 AND 6),
  token            TEXT NOT NULL UNIQUE,
  config_json      TEXT,
  indicator_id     TEXT,
  created_at       TEXT NOT NULL,
  started_at       TEXT,
  cuidado_at       TEXT,
  entregado_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_kits_consultant ON kits(consultant_id);
CREATE TABLE IF NOT EXISTS kit_answers (
  id                 TEXT PRIMARY KEY,
  kit_id             TEXT NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
  field_key          TEXT NOT NULL,
  primera_respuesta  TEXT,
  primera_at         TEXT,
  respuesta_final    TEXT,
  final_at           TEXT,
  UNIQUE (kit_id, field_key)
);
CREATE TABLE IF NOT EXISTS kit_events (
  id               TEXT PRIMARY KEY,
  kit_id           TEXT NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
  tipo             TEXT NOT NULL CHECK (tipo IN ('guardado','cuidado','entregado')),
  section_key      TEXT,
  at               TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_kit_events_kit ON kit_events(kit_id, at);
CREATE TABLE IF NOT EXISTS witness_proposals (
  id               TEXT PRIMARY KEY,
  consultant_id    TEXT NOT NULL REFERENCES consultants(id) ON DELETE CASCADE,
  kit_id           TEXT,
  nombre           TEXT,
  motivo           TEXT,
  estado           TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','confirmado','descartado')),
  created_at       TEXT NOT NULL,
  updated_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_witness_prop_consultant ON witness_proposals(consultant_id);
CREATE TABLE IF NOT EXISTS identity_act_drafts (
  id               TEXT PRIMARY KEY,
  consultant_id    TEXT NOT NULL REFERENCES consultants(id) ON DELETE CASCADE,
  kit_id           TEXT,
  fecha            TEXT NOT NULL,
  fase             INTEGER CHECK (fase BETWEEN 0 AND 6),
  con_quien        TEXT,
  que_dije         TEXT,
  cuerpo           TEXT,
  estado           TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','confirmado','descartado')),
  identity_act_id  TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_act_drafts_consultant ON identity_act_drafts(consultant_id);
CREATE TABLE IF NOT EXISTS arcon_v2 (
  id               TEXT PRIMARY KEY,
  consultant_id    TEXT NOT NULL REFERENCES consultants(id) ON DELETE CASCADE,
  momento          TEXT NOT NULL CHECK (momento IN (
                     'sesion0','kit_f1','fin_f1','kit_f2','fin_f2','kit_f3','fin_f3','kit_f4','fin_f4',
                     'kit_f5','fin_f5','kit_f6','fin_f6','final','sosten30','sosten60','sosten90')),
  quien            TEXT NOT NULL CHECK (quien IN ('consultante','mentor')),
  autenticidad     INTEGER CHECK (autenticidad BETWEEN 1 AND 5),
  resonancia       INTEGER CHECK (resonancia BETWEEN 1 AND 5),
  coherencia       INTEGER CHECK (coherencia BETWEEN 1 AND 5),
  observacion      INTEGER CHECK (observacion BETWEEN 1 AND 5),
  narrativa        INTEGER CHECK (narrativa BETWEEN 1 AND 5),
  fecha            TEXT NOT NULL,
  UNIQUE (consultant_id, momento, quien)
);
INSERT OR IGNORE INTO arcon_v2 SELECT id, consultant_id, momento, quien, autenticidad, resonancia, coherencia, observacion, narrativa, fecha FROM arcon;
DROP TABLE arcon;
ALTER TABLE arcon_v2 RENAME TO arcon;
