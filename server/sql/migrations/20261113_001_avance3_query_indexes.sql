BEGIN;

CREATE INDEX IF NOT EXISTS idx_reportes_autor_fecha
  ON reportes_objetos (usuario_creador_id, fecha_creacion DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_reclamaciones_reporte_fecha
  ON reclamaciones (reporte_id, fecha_reclamacion DESC, id DESC);

COMMIT;
