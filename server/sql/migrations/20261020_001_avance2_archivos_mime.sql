BEGIN;

ALTER TABLE archivos_metadatos
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream';

CREATE INDEX IF NOT EXISTS idx_archivos_reporte
  ON archivos_metadatos (reporte_id);

CREATE INDEX IF NOT EXISTS idx_archivos_autor
  ON archivos_metadatos (usuario_autor_id);

COMMIT;
