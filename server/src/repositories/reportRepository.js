const pool = require('../config/database');
const ApiError = require('../errors/ApiError');
const {
  stageUploadedFiles,
  restoreStagedFiles,
  purgeStagedFiles,
} = require('../middleware/reportUpload');

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

async function findReportById(id, executor = pool) {
  const result = await executor.query(
    `${REPORT_SELECT}
     WHERE r.id = $1
     ORDER BY file.fecha_subida ASC NULLS LAST, file.id ASC NULLS LAST
     LIMIT 1`,
    [id],
  );
  return result.rows[0] || null;
}

async function createReport(input, file, userId) {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query('BEGIN');
    transactionOpen = true;

    const created = await client.query(
      `INSERT INTO reportes_objetos
         (usuario_creador_id, categoria_id, ubicacion_id, titulo, descripcion,
          tipo_reporte, fecha_hora_evento)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id::text AS id`,
      [
        userId,
        input.categoriaId,
        input.ubicacionId,
        input.titulo,
        input.descripcion,
        input.tipoReporte,
        input.fechaHoraEvento,
      ],
    );
    const reportId = created.rows[0]?.id;
    if (!reportId) throw new Error('Report insert did not return an id.');

    await client.query(
      `INSERT INTO archivos_metadatos
         (reporte_id, usuario_autor_id, nombre_original, nombre_fisico,
          ruta_url, mime_type, extension, peso_bytes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        reportId,
        userId,
        file.originalName,
        file.filename,
        `/uploads/${file.filename}`,
        file.mimeType,
        file.extension,
        file.size,
      ],
    );

    const report = await findReportById(reportId, client);
    if (!report) throw new Error('Created report could not be read in its transaction.');

    await client.query('COMMIT');
    transactionOpen = false;
    return report;
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Keep the original database error for the API's sanitized error handler.
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

async function lockReportForManagement(client, id, actor) {
  const result = await client.query(
    `SELECT id::text AS id, usuario_creador_id::text AS "ownerId"
     FROM reportes_objetos
     WHERE id = $1
     FOR UPDATE`,
    [id],
  );
  const report = result.rows[0];
  if (!report) {
    throw new ApiError(404, 'REPORT_NOT_FOUND', 'El reporte solicitado no existe.');
  }
  if (report.ownerId !== String(actor.id) && actor.rol !== 'Administrador') {
    throw new ApiError(403, 'FORBIDDEN', 'No tienes permiso para modificar este reporte.');
  }
  return report;
}

async function updateReport(id, input, file, actor) {
  const client = await pool.connect();
  let transactionOpen = false;
  let stagedFiles = [];
  try {
    await client.query('BEGIN');
    transactionOpen = true;
    await lockReportForManagement(client, id, actor);

    await client.query(
      `UPDATE reportes_objetos
       SET titulo = $1,
           descripcion = $2,
           categoria_id = $3,
           ubicacion_id = $4,
           tipo_reporte = $5,
           fecha_hora_evento = $6,
           estado = COALESCE($7, estado)
       WHERE id = $8`,
      [
        input.titulo,
        input.descripcion,
        input.categoriaId,
        input.ubicacionId,
        input.tipoReporte,
        input.fechaHoraEvento,
        input.estado || null,
        id,
      ],
    );

    if (file) {
      const oldFiles = await client.query(
        `SELECT nombre_fisico AS filename
         FROM archivos_metadatos
         WHERE reporte_id = $1
         FOR UPDATE`,
        [id],
      );
      stagedFiles = await stageUploadedFiles(oldFiles.rows.map(row => row.filename));
      await client.query('DELETE FROM archivos_metadatos WHERE reporte_id = $1', [id]);
      await client.query(
        `INSERT INTO archivos_metadatos
           (reporte_id, usuario_autor_id, nombre_original, nombre_fisico,
            ruta_url, mime_type, extension, peso_bytes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          actor.id,
          file.originalName,
          file.filename,
          `/uploads/${file.filename}`,
          file.mimeType,
          file.extension,
          file.size,
        ],
      );
    }

    const updated = await findReportById(id, client);
    if (!updated) {
      throw new ApiError(404, 'REPORT_NOT_FOUND', 'El reporte solicitado no existe.');
    }
    await client.query('COMMIT');
    transactionOpen = false;
    await purgeStagedFiles(stagedFiles);
    return updated;
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original database or authorization error.
      }
    }
    try {
      await restoreStagedFiles(stagedFiles);
    } catch {
      // Preserve the API error; no user-supplied path is used for restoration.
    }
    throw error;
  } finally {
    client.release();
  }
}

async function deleteReport(id, actor) {
  const client = await pool.connect();
  let transactionOpen = false;
  let stagedFiles = [];
  try {
    await client.query('BEGIN');
    transactionOpen = true;
    await lockReportForManagement(client, id, actor);

    const oldFiles = await client.query(
      `SELECT nombre_fisico AS filename
       FROM archivos_metadatos
       WHERE reporte_id = $1
       FOR UPDATE`,
      [id],
    );
    stagedFiles = await stageUploadedFiles(oldFiles.rows.map(row => row.filename));

    const result = await client.query(
      'DELETE FROM reportes_objetos WHERE id = $1 RETURNING id',
      [id],
    );
    if (!result.rows.length) {
      throw new ApiError(404, 'REPORT_NOT_FOUND', 'El reporte solicitado no existe.');
    }

    await client.query('COMMIT');
    transactionOpen = false;
    await purgeStagedFiles(stagedFiles);
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original database or authorization error.
      }
    }
    try {
      await restoreStagedFiles(stagedFiles);
    } catch {
      // Preserve the API error; no user-supplied path is used for restoration.
    }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listReports,
  findReportById,
  createReport,
  updateReport,
  deleteReport,
};
