BEGIN;

CREATE TABLE IF NOT EXISTS reclamaciones_archivos_metadatos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reclamacion_id BIGINT NOT NULL UNIQUE REFERENCES reclamaciones(id),
  usuario_autor_id BIGINT NOT NULL REFERENCES usuarios(id),
  nombre_original VARCHAR(255) NOT NULL,
  nombre_fisico VARCHAR(255) NOT NULL UNIQUE,
  mime_type VARCHAR(100) NOT NULL,
  extension VARCHAR(10) NOT NULL,
  peso_bytes BIGINT NOT NULL CHECK (peso_bytes > 0 AND peso_bytes <= 5242880),
  ubicacion_interna VARCHAR(320) NOT NULL,
  fecha_subida TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (mime_type = 'image/jpeg' AND extension = '.jpg') OR
    (mime_type = 'image/png' AND extension = '.png') OR
    (mime_type = 'image/webp' AND extension = '.webp')
  ),
  CHECK (ubicacion_interna = 'private_uploads/' || nombre_fisico)
);

CREATE INDEX IF NOT EXISTS idx_reclamaciones_usuario_fecha
  ON reclamaciones (usuario_reclamante_id, fecha_reclamacion DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_reclamaciones_evidencia_autor
  ON reclamaciones_archivos_metadatos (usuario_autor_id, fecha_subida DESC, id DESC);

COMMIT;
