const pool = require('../config/database');
const ApiError = require('../errors/ApiError');

const CLAIM_SELECT = `
  SELECT c.id::text AS id,
         c.reporte_id::text AS "reporteId",
         c.usuario_reclamante_id::text AS "reclamanteId",
         claimant.nombre_completo AS "reclamanteNombre",
         c.mensaje_prueba AS "mensajePrueba",
         c.fecha_reclamacion AS "fechaReclamacion",
         c.estado AS "estado",
         r.titulo AS "reporteTitulo",
         r.tipo_reporte AS "reporteTipo",
         r.estado AS "reporteEstado",
         r.usuario_creador_id::text AS "autorReporteId",
         owner.nombre_completo AS "autorReporteNombre",
         evidence.id::text AS "evidenciaId",
         evidence.nombre_original AS "evidenciaNombreOriginal",
         evidence.mime_type AS "evidenciaMimeType",
         evidence.extension AS "evidenciaExtension",
         evidence.peso_bytes::text AS "evidenciaPesoBytes",
         evidence.fecha_subida AS "evidenciaFechaSubida",
         evidence.nombre_fisico AS "evidenciaNombreFisico"
  FROM reclamaciones c
  JOIN usuarios claimant ON claimant.id = c.usuario_reclamante_id
  JOIN reportes_objetos r ON r.id = c.reporte_id
  JOIN usuarios owner ON owner.id = r.usuario_creador_id
  LEFT JOIN reclamaciones_archivos_metadatos evidence ON evidence.reclamacion_id = c.id`;

const CLAIM_LIST_SELECT = CLAIM_SELECT.replace(
  '  SELECT c.id::text AS id,',
  '  SELECT COUNT(*) OVER()::text AS total,\n         c.id::text AS id,',
);

function validateClaimableReport(report, userId) {
  if (report.ownerId === String(userId)) {
    throw new ApiError(409, 'REPORT_OWNER_CANNOT_CLAIM', 'No puedes reclamar un reporte que publicaste.');
  }
  if (report.type !== 'Encontrado') {
    throw new ApiError(409, 'REPORT_NOT_FOUND_TYPE', 'Solo se pueden reclamar reportes de objetos encontrados.');
  }
  if (report.status === 'Devuelto') {
    throw new ApiError(409, 'REPORT_ALREADY_RETURNED', 'El objeto ya fue devuelto y no admite nuevas reclamaciones.');
  }
  if (report.status !== 'Publicado' && report.status !== 'En reclamación') {
    throw new ApiError(409, 'REPORT_NOT_CLAIMABLE', 'El reporte no admite nuevas reclamaciones.');
  }
}

async function createClaim({ reportId, userId, message, evidence }) {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query('BEGIN');
    transactionOpen = true;

    const lockedReport = await client.query(
      `SELECT id::text AS id,
              usuario_creador_id::text AS "ownerId",
              tipo_reporte AS "type",
              estado AS "status"
       FROM reportes_objetos
       WHERE id = $1
       FOR UPDATE`,
      [reportId],
    );
    const report = lockedReport.rows[0];
    if (!report) {
      throw new ApiError(404, 'REPORT_NOT_FOUND', 'El reporte solicitado no existe.');
    }
    validateClaimableReport(report, userId);

    let insertedClaim;
    try {
      insertedClaim = await client.query(
        `INSERT INTO reclamaciones (usuario_reclamante_id, reporte_id, mensaje_prueba)
         VALUES ($1, $2, $3)
         RETURNING id::text AS id,
                   usuario_reclamante_id::text AS "reclamanteId",
                   reporte_id::text AS "reporteId",
                   mensaje_prueba AS "mensajePrueba",
                   fecha_reclamacion AS "fechaReclamacion",
                   estado`,
        [userId, reportId, message],
      );
    } catch (error) {
      if (error.code === '23505') {
        throw new ApiError(409, 'DUPLICATE_CLAIM', 'Ya presentaste una reclamación para este reporte.');
      }
      throw error;
    }
    const claim = insertedClaim.rows[0];
    if (!claim) throw new Error('Claim insert did not return an id.');

    const insertedEvidence = await client.query(
      `INSERT INTO reclamaciones_archivos_metadatos
         (reclamacion_id, usuario_autor_id, nombre_original, nombre_fisico,
          mime_type, extension, peso_bytes, ubicacion_interna)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id::text AS id,
                 nombre_original AS "nombreOriginal",
                 mime_type AS "mimeType",
                 extension,
                 peso_bytes::text AS "pesoBytes",
                 fecha_subida AS "fechaSubida"`,
      [
        claim.id,
        userId,
        evidence.originalName,
        evidence.filename,
        evidence.mimeType,
        evidence.extension,
        evidence.size,
        evidence.internalLocation,
      ],
    );
    const metadata = insertedEvidence.rows[0];
    if (!metadata) throw new Error('Claim evidence insert did not return an id.');

    await client.query(
      `UPDATE reportes_objetos
       SET estado = 'En reclamación'
       WHERE id = $1`,
      [reportId],
    );

    await client.query('COMMIT');
    transactionOpen = false;
    return {
      ...claim,
      evidencia: {
        id: metadata.id,
        nombreOriginal: metadata.nombreOriginal,
        mimeType: metadata.mimeType,
        extension: metadata.extension,
        pesoBytes: Number(metadata.pesoBytes),
        fechaSubida: metadata.fechaSubida,
      },
    };
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original SQL or business error.
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

async function findClaimById(id) {
  const result = await pool.query(`${CLAIM_SELECT} WHERE c.id = $1`, [id]);
  return result.rows[0] || null;
}

async function findClaimByIdWithExecutor(id, executor = pool) {
  const result = await executor.query(`${CLAIM_SELECT} WHERE c.id = $1`, [id]);
  return result.rows[0] || null;
}

async function decideClaim({ id, status, actor }) {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query('BEGIN');
    transactionOpen = true;

    const claimReference = await client.query(
      'SELECT reporte_id::text AS "reporteId" FROM reclamaciones WHERE id = $1',
      [id],
    );
    if (!claimReference.rows[0]) {
      throw new ApiError(404, 'CLAIM_NOT_FOUND', 'La reclamación solicitada no existe.');
    }

    const lockedReport = await client.query(
      `SELECT id::text AS id,
              usuario_creador_id::text AS "ownerId",
              estado AS "status"
       FROM reportes_objetos
       WHERE id = $1
       FOR UPDATE`,
      [claimReference.rows[0].reporteId],
    );
    const report = lockedReport.rows[0];
    if (!report) throw new ApiError(404, 'REPORT_NOT_FOUND', 'El reporte solicitado no existe.');
    if (String(actor.id) !== report.ownerId && actor.rol !== 'Administrador') {
      throw new ApiError(403, 'FORBIDDEN', 'Solo el autor del reporte o un administrador puede decidir la reclamación.');
    }

    const lockedClaim = await client.query(
      'SELECT estado FROM reclamaciones WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (!lockedClaim.rows[0]) {
      throw new ApiError(404, 'CLAIM_NOT_FOUND', 'La reclamación solicitada no existe.');
    }
    if (lockedClaim.rows[0].estado !== 'Pendiente') {
      throw new ApiError(409, 'CLAIM_ALREADY_DECIDED', 'La reclamación ya fue decidida.');
    }

    await client.query(
      'UPDATE reclamaciones SET estado = $1 WHERE id = $2 AND estado = \'Pendiente\'',
      [status, id],
    );

    if (status === 'Aprobada') {
      await client.query(
        `UPDATE reclamaciones
         SET estado = 'Rechazada'
         WHERE reporte_id = $1 AND id <> $2 AND estado = 'Pendiente'`,
        [claimReference.rows[0].reporteId, id],
      );
      await client.query(
        "UPDATE reportes_objetos SET estado = 'Devuelto' WHERE id = $1",
        [claimReference.rows[0].reporteId],
      );
    } else {
      const remaining = await client.query(
        `SELECT COUNT(*) FILTER (WHERE estado = 'Pendiente')::text AS pendientes,
                COUNT(*) FILTER (WHERE estado = 'Aprobada')::text AS aprobadas
         FROM reclamaciones
         WHERE reporte_id = $1`,
        [claimReference.rows[0].reporteId],
      );
      const pendingCount = Number(remaining.rows[0]?.pendientes || 0);
      const approvedCount = Number(remaining.rows[0]?.aprobadas || 0);
      if (pendingCount === 0 && approvedCount === 0) {
        await client.query(
          "UPDATE reportes_objetos SET estado = 'Publicado' WHERE id = $1",
          [claimReference.rows[0].reporteId],
        );
      }
    }

    const updated = await findClaimByIdWithExecutor(id, client);
    if (!updated) throw new ApiError(404, 'CLAIM_NOT_FOUND', 'La reclamación solicitada no existe.');
    await client.query('COMMIT');
    transactionOpen = false;
    return updated;
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original SQL or business error.
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

async function findReportOwner(reportId) {
  const result = await pool.query(
    `SELECT id::text AS id, usuario_creador_id::text AS "ownerId"
     FROM reportes_objetos
     WHERE id = $1`,
    [reportId],
  );
  return result.rows[0] || null;
}

async function listClaims({ where, values, page, limit }) {
  const limitParameter = values.length + 1;
  const offsetParameter = values.length + 2;
  const result = await pool.query(
    `${CLAIM_LIST_SELECT}${where}
     ORDER BY c.fecha_reclamacion DESC, c.id DESC
     LIMIT $${limitParameter} OFFSET $${offsetParameter}`,
    [...values, limit, (page - 1) * limit],
  );
  let total = Number(result.rows[0]?.total || 0);
  if (result.rows.length === 0) {
    const count = await pool.query(
      `SELECT COUNT(*)::text AS total
       FROM reclamaciones c
       JOIN reportes_objetos r ON r.id = c.reporte_id${where}`,
      values,
    );
    total = Number(count.rows[0]?.total || 0);
  }
  return { rows: result.rows, total };
}

async function listClaimsForReport({ reportId, page, limit }) {
  return listClaims({
    where: ' WHERE c.reporte_id = $1',
    values: [reportId],
    page,
    limit,
  });
}

async function listClaimsForUser({ userId, page, limit }) {
  return listClaims({
    where: ' WHERE c.usuario_reclamante_id = $1',
    values: [userId],
    page,
    limit,
  });
}

async function listReceivedClaims({ userId, isAdmin, page, limit }) {
  return listClaims({
    where: isAdmin ? '' : ' WHERE r.usuario_creador_id = $1',
    values: isAdmin ? [] : [userId],
    page,
    limit,
  });
}

module.exports = {
  createClaim,
  validateClaimableReport,
  findClaimById,
  decideClaim,
  findReportOwner,
  listClaimsForReport,
  listClaimsForUser,
  listReceivedClaims,
};
