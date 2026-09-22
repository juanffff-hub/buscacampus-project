-- BuscaCampus · MER del Avance 1 · PostgreSQL 14+
-- La transacción que cree un reporte debe insertar al menos un archivo antes
-- del COMMIT. Esta regla 1..N se validará en el servicio transaccional.

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre_completo VARCHAR(160) NOT NULL,
  correo_electronico VARCHAR(254) NOT NULL UNIQUE,
  contrasena_hash TEXT NOT NULL,
  rol VARCHAR(20) NOT NULL DEFAULT 'Usuario' CHECK (rol IN ('Usuario', 'Administrador')),
  fecha_registro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  estado VARCHAR(10) NOT NULL DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Inactivo'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_correo_ci ON usuarios (LOWER(correo_electronico));

CREATE TABLE IF NOT EXISTS categorias (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  descripcion TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS ubicaciones (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre_zona VARCHAR(140) NOT NULL UNIQUE,
  estado VARCHAR(10) NOT NULL DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Inactivo'))
);

CREATE TABLE IF NOT EXISTS reportes_objetos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_creador_id BIGINT NOT NULL REFERENCES usuarios(id),
  categoria_id BIGINT NOT NULL REFERENCES categorias(id),
  ubicacion_id BIGINT NOT NULL REFERENCES ubicaciones(id),
  titulo VARCHAR(180) NOT NULL,
  descripcion TEXT NOT NULL,
  tipo_reporte VARCHAR(12) NOT NULL CHECK (tipo_reporte IN ('Perdido', 'Encontrado')),
  fecha_hora_evento TIMESTAMPTZ NOT NULL,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  estado VARCHAR(20) NOT NULL DEFAULT 'Publicado'
    CHECK (estado IN ('Publicado', 'En reclamación', 'Devuelto'))
);

CREATE TABLE IF NOT EXISTS archivos_metadatos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reporte_id BIGINT NOT NULL REFERENCES reportes_objetos(id) ON DELETE CASCADE,
  usuario_autor_id BIGINT NOT NULL REFERENCES usuarios(id),
  nombre_original VARCHAR(255) NOT NULL,
  nombre_fisico VARCHAR(255) NOT NULL UNIQUE,
  ruta_url TEXT NOT NULL,
  extension VARCHAR(20) NOT NULL,
  peso_bytes BIGINT NOT NULL CHECK (peso_bytes > 0),
  fecha_subida TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reclamaciones (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_reclamante_id BIGINT NOT NULL REFERENCES usuarios(id),
  reporte_id BIGINT NOT NULL REFERENCES reportes_objetos(id),
  mensaje_prueba TEXT NOT NULL,
  fecha_reclamacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  estado VARCHAR(12) NOT NULL DEFAULT 'Pendiente'
    CHECK (estado IN ('Pendiente', 'Aprobada', 'Rechazada')),
  UNIQUE (usuario_reclamante_id, reporte_id)
);

CREATE INDEX IF NOT EXISTS idx_reportes_fecha ON reportes_objetos (fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_reportes_filtros ON reportes_objetos (categoria_id, ubicacion_id, tipo_reporte);
CREATE INDEX IF NOT EXISTS idx_archivos_reporte ON archivos_metadatos (reporte_id);
CREATE INDEX IF NOT EXISTS idx_reclamaciones_reporte ON reclamaciones (reporte_id);
