const pool = require('../config/database');

const REPORT_SELECT = `
  SELECT
    r.id::text AS id,
    r.titulo AS "titulo",
    r.descripcion AS "descripcion",
    r.tipo_reporte AS "tipoReporte",
    r.estado AS "estado",
    r.fecha_hora_evento AS "fechaHoraEvento",
    r.fecha_creacion AS "fechaCreacion",
    u.id::text AS "autorId",
    u.nombre_completo AS "autorNombre",
    c.id::text AS "categoriaId",
    c.nombre AS "categoriaNombre",
    l.id::text AS "ubicacionId",
    l.nombre_zona AS "ubicacionNombre",
    file.id::text AS "imagenId",
    file.nombre_original AS "imagenNombreOriginal",
    file.nombre_fisico AS "imagenNombreFisico",
    file.ruta_url AS "imagenUrl",
    file.mime_type AS "imagenMimeType",
    file.extension AS "imagenExtension",
    file.peso_bytes::text AS "imagenPesoBytes",
    file.fecha_subida AS "imagenFechaSubida"
  FROM reportes_objetos r
  JOIN usuarios u ON u.id = r.usuario_creador_id
  JOIN categorias c ON c.id = r.categoria_id
  JOIN ubicaciones l ON l.id = r.ubicacion_id
  LEFT JOIN LATERAL (
    SELECT am.id, am.nombre_original, am.nombre_fisico, am.ruta_url,
           am.mime_type, am.extension, am.peso_bytes, am.fecha_subida
    FROM archivos_metadatos am
    WHERE am.reporte_id = r.id
    ORDER BY am.fecha_subida ASC, am.id ASC
    LIMIT 1
  ) file ON TRUE`;

function buildFilters(filters, userId) {
  const values = [];
  const conditions = [];
  const add = (condition, value) => {
    values.push(value);
    conditions.push(condition.replace('?', `$${values.length}`));
  };

  if (filters.q) {
    values.push(`%${filters.q}%`);
    const parameter = `$${values.length}`;
    conditions.push(
      `(r.titulo ILIKE ${parameter} OR r.descripcion ILIKE ${parameter} OR ` +
      `c.nombre ILIKE ${parameter} OR l.nombre_zona ILIKE ${parameter} OR ` +
      `u.nombre_completo ILIKE ${parameter})`,
    );
  }
  if (filters.categoriaId) add('r.categoria_id = ?', filters.categoriaId);
  if (filters.ubicacionId) add('r.ubicacion_id = ?', filters.ubicacionId);
  if (filters.tipoReporte) add('r.tipo_reporte = ?', filters.tipoReporte);
  if (filters.estado) add('r.estado = ?', filters.estado);
  if (filters.mios) {
    if (!userId) {
      const ApiError = require('../errors/ApiError');
      throw new ApiError(401, 'UNAUTHENTICATED', 'Debes iniciar sesión para continuar.');
    }
    add('r.usuario_creador_id = ?', userId);
  }

  return {
    values,
    sql: conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '',
  };
}

async function listReports(filters, userId) {
  const where = buildFilters(filters, userId);
  const countResult = await pool.query(
    `SELECT COUNT(*)::text AS total
     FROM reportes_objetos r
     JOIN usuarios u ON u.id = r.usuario_creador_id
     JOIN categorias c ON c.id = r.categoria_id
     JOIN ubicaciones l ON l.id = r.ubicacion_id${where.sql}`,
    where.values,
  );

  const limitParameter = where.values.length + 1;
  const offsetParameter = where.values.length + 2;
  const values = [
    ...where.values,
    filters.limit,
    (filters.page - 1) * filters.limit,
  ];
  const result = await pool.query(
    `${REPORT_SELECT}${where.sql}
     ORDER BY r.fecha_creacion DESC, r.id DESC
     LIMIT $${limitParameter} OFFSET $${offsetParameter}`,
    values,
  );

  return {
    rows: result.rows,
    total: Number(countResult.rows[0]?.total || 0),
  };
}

async function findReportById(id) {
  const result = await pool.query(
    `${REPORT_SELECT}
     WHERE r.id = $1
     ORDER BY file.fecha_subida ASC NULLS LAST, file.id ASC NULLS LAST
     LIMIT 1`,
    [id],
  );
  return result.rows[0] || null;
}

module.exports = { listReports, findReportById };
