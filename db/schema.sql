-- ---------------------------------------------------------------
-- IG SEARCH - esquema SQLite
-- Sin servidor, sin proveedor: un unico fichero en disco.
-- ---------------------------------------------------------------

-- Negocios detectados por el radar (fuente: OpenStreetMap)
CREATE TABLE IF NOT EXISTS negocios (
  id                  TEXT PRIMARY KEY,              -- "node/123456" de OSM
  nombre              TEXT NOT NULL,
  sector              TEXT,
  direccion           TEXT,
  telefono            TEXT,
  web                 TEXT,
  osm_url             TEXT,
  instagram_tag       TEXT,                          -- handle declarado en OSM, si lo hay
  tiene_horario       INTEGER NOT NULL DEFAULT 0,
  es_cadena           INTEGER NOT NULL DEFAULT 0,
  lat                 REAL,
  lng                 REAL,
  creado_en           TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Auditoria de la web del negocio (analisis propio, sin servicios externos)
CREATE TABLE IF NOT EXISTS auditorias_web (
  negocio_id          TEXT PRIMARY KEY REFERENCES negocios(id) ON DELETE CASCADE,
  tiene_web           INTEGER NOT NULL DEFAULT 0,
  accesible           INTEGER,
  codigo_http         INTEGER,
  https               INTEGER,
  responsive          INTEGER,
  segundos_carga      REAL,
  peso_kb             INTEGER,
  tecnologia          TEXT,                          -- wix, wordpress, jimdo, godaddy...
  plantilla_barata    INTEGER,                       -- creador de webs de plantilla
  anio_copyright      INTEGER,                       -- ultimo anio visible en el pie
  titulo              TEXT,
  instagram_handle    TEXT,
  problemas           TEXT,                          -- JSON con la lista de fallos detectados
  notas               TEXT,
  revisado_en         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Datos publicos de Instagram (API oficial de Meta, Business Discovery)
CREATE TABLE IF NOT EXISTS perfiles_ig (
  handle              TEXT PRIMARY KEY,
  negocio_id          TEXT REFERENCES negocios(id) ON DELETE SET NULL,
  seguidores          INTEGER,
  num_publicaciones   INTEGER,
  biografia           TEXT,
  web_perfil          TEXT,
  ultima_publicacion  TEXT,
  engagement_medio    REAL,
  frecuencia_semanal  REAL,
  es_competidor       INTEGER NOT NULL DEFAULT 0,
  revisado_en         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS publicaciones (
  id                  TEXT PRIMARY KEY,
  handle              TEXT NOT NULL,
  tipo                TEXT,
  texto               TEXT,
  permalink           TEXT,
  likes               INTEGER,
  comentarios         INTEGER,
  publicada_en        TEXT,
  registrada_en       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_publicaciones_handle ON publicaciones(handle, publicada_en DESC);

-- Puntuacion de oportunidad comercial
CREATE TABLE IF NOT EXISTS leads (
  negocio_id          TEXT PRIMARY KEY REFERENCES negocios(id) ON DELETE CASCADE,
  score               INTEGER NOT NULL DEFAULT 0,
  motivos             TEXT NOT NULL DEFAULT '[]',    -- JSON
  estado              TEXT NOT NULL DEFAULT 'nuevo', -- nuevo|contactado|en_conversacion|cliente|descartado
  nota                TEXT,
  calculado_en        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_estado ON leads(estado);

-- Lista diaria de acciones
CREATE TABLE IF NOT EXISTS tareas_diarias (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha               TEXT NOT NULL,                 -- YYYY-MM-DD
  tipo                TEXT NOT NULL,                 -- comentar|like|seguir|revisar
  negocio_id          TEXT REFERENCES negocios(id) ON DELETE CASCADE,
  handle              TEXT,
  enlace              TEXT,
  contexto            TEXT,
  hecha               INTEGER NOT NULL DEFAULT 0,
  hecha_en            TEXT,
  creada_en           TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tareas_fecha ON tareas_diarias(fecha, hecha);

-- Metricas de la cuenta propia
CREATE TABLE IF NOT EXISTS metricas_propias (
  fecha               TEXT PRIMARY KEY,
  seguidores          INTEGER,
  alcance             INTEGER,
  visitas_perfil      INTEGER,
  clics_web           INTEGER,
  interacciones       INTEGER,
  registrada_en       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Registro de ejecuciones del radar
CREATE TABLE IF NOT EXISTS ejecuciones (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  iniciada_en         TEXT NOT NULL DEFAULT (datetime('now')),
  terminada_en        TEXT,
  estado              TEXT NOT NULL DEFAULT 'en_curso',
  negocios_nuevos     INTEGER DEFAULT 0,
  webs_auditadas      INTEGER DEFAULT 0,
  perfiles_ig         INTEGER DEFAULT 0,
  tareas_generadas    INTEGER DEFAULT 0,
  error               TEXT
);
