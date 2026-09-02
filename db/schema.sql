-- ---------------------------------------------------------------
-- IG SEARCH - esquema de base de datos
-- ---------------------------------------------------------------

-- Negocios detectados por el radar (fuente: Google Places)
CREATE TABLE IF NOT EXISTS negocios (
  id                  TEXT PRIMARY KEY,              -- place_id de Google
  nombre              TEXT NOT NULL,
  sector              TEXT,
  direccion           TEXT,
  telefono            TEXT,
  web                 TEXT,
  google_maps_url     TEXT,
  valoracion          NUMERIC(2,1),
  num_resenas         INTEGER,
  lat                 NUMERIC(10,7),
  lng                 NUMERIC(10,7),
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Resultado de la auditoria de la web del negocio
CREATE TABLE IF NOT EXISTS auditorias_web (
  negocio_id          TEXT PRIMARY KEY REFERENCES negocios(id) ON DELETE CASCADE,
  tiene_web           BOOLEAN NOT NULL DEFAULT false,
  accesible           BOOLEAN,
  codigo_http         INTEGER,
  https               BOOLEAN,
  responsive          BOOLEAN,
  segundos_carga      NUMERIC(6,2),
  puntuacion_psi      INTEGER,                       -- 0-100 PageSpeed movil
  titulo              TEXT,
  instagram_handle    TEXT,
  notas               TEXT,
  revisado_en         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Datos publicos de la cuenta de Instagram del negocio (Business Discovery)
CREATE TABLE IF NOT EXISTS perfiles_ig (
  handle              TEXT PRIMARY KEY,
  negocio_id          TEXT REFERENCES negocios(id) ON DELETE SET NULL,
  seguidores          INTEGER,
  num_publicaciones   INTEGER,
  biografia           TEXT,
  web_perfil          TEXT,
  ultima_publicacion  TIMESTAMPTZ,
  engagement_medio    NUMERIC(6,3),                  -- (likes+comentarios)/seguidores
  frecuencia_semanal  NUMERIC(6,2),
  es_competidor       BOOLEAN NOT NULL DEFAULT false,
  revisado_en         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Publicaciones observadas (propias, de competidores o de leads)
CREATE TABLE IF NOT EXISTS publicaciones (
  id                  TEXT PRIMARY KEY,
  handle              TEXT NOT NULL,
  tipo                TEXT,
  texto               TEXT,
  permalink           TEXT,
  likes               INTEGER,
  comentarios         INTEGER,
  publicada_en        TIMESTAMPTZ,
  registrada_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_publicaciones_handle ON publicaciones(handle, publicada_en DESC);

-- Puntuacion de oportunidad calculada cada noche
CREATE TABLE IF NOT EXISTS leads (
  negocio_id          TEXT PRIMARY KEY REFERENCES negocios(id) ON DELETE CASCADE,
  score               INTEGER NOT NULL DEFAULT 0,
  motivos             JSONB NOT NULL DEFAULT '[]'::jsonb,
  estado              TEXT NOT NULL DEFAULT 'nuevo',  -- nuevo|contactado|en_conversacion|cliente|descartado
  nota                TEXT,
  calculado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_estado ON leads(estado);

-- Lista diaria que ve el usuario en el panel
CREATE TABLE IF NOT EXISTS tareas_diarias (
  id                  SERIAL PRIMARY KEY,
  fecha               DATE NOT NULL,
  tipo                TEXT NOT NULL,                  -- comentar|like|seguir|responder|publicar
  negocio_id          TEXT REFERENCES negocios(id) ON DELETE CASCADE,
  handle              TEXT,
  enlace              TEXT,
  contexto            TEXT,
  hecha               BOOLEAN NOT NULL DEFAULT false,
  hecha_en            TIMESTAMPTZ,
  creada_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tareas_fecha ON tareas_diarias(fecha, hecha);

-- Metricas propias de la cuenta de la agencia
CREATE TABLE IF NOT EXISTS metricas_propias (
  fecha               DATE PRIMARY KEY,
  seguidores          INTEGER,
  alcance             INTEGER,
  visitas_perfil      INTEGER,
  clics_web           INTEGER,
  interacciones       INTEGER,
  registrada_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Registro de ejecuciones del radar
CREATE TABLE IF NOT EXISTS ejecuciones (
  id                  SERIAL PRIMARY KEY,
  iniciada_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
  terminada_en        TIMESTAMPTZ,
  estado              TEXT NOT NULL DEFAULT 'en_curso', -- en_curso|ok|error
  negocios_nuevos     INTEGER DEFAULT 0,
  webs_auditadas      INTEGER DEFAULT 0,
  perfiles_ig         INTEGER DEFAULT 0,
  tareas_generadas    INTEGER DEFAULT 0,
  error               TEXT
);
