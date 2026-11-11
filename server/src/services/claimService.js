const path = require('node:path');
const claimRepository = require('../repositories/claimRepository');
const ApiError = require('../errors/ApiError');
const {
  deletePrivateEvidenceFile,
  resolvePrivateEvidencePath,
  sanitizeOriginalName,
} = require('../middleware/claimEvidenceUpload');

function toEvidenceMetadata(uploadedFile) {
  return {
    originalName: sanitizeOriginalName(uploadedFile.originalname),
    filename: uploadedFile.filename,
    mimeType: uploadedFile.mimetype,
    extension: path.extname(uploadedFile.filename),
    size: uploadedFile.size,
    internalLocation: `private_uploads/${uploadedFile.filename}`,
  };
}

async function createClaim({ reportId, userId, message, uploadedFile }) {
  try {
    return await claimRepository.createClaim({
      reportId,
      userId,
      message,
      evidence: toEvidenceMetadata(uploadedFile),
    });
  } catch (error) {
    try {
      await deletePrivateEvidenceFile(uploadedFile.filename);
    } catch {
      // Keep the database error; never disclose physical paths.
    }

    throw error;
  }
}

function toPublicClaim(row) {
  return {
    id: row.id,
    mensajePrueba: row.mensajePrueba,
    fechaReclamacion: row.fechaReclamacion,
    estado: row.estado,
    reclamante: {
      id: row.reclamanteId,
      nombreCompleto: row.reclamanteNombre,
    },
    reporte: {
      id: row.reporteId,
      titulo: row.reporteTitulo,
      tipoReporte: row.reporteTipo,
      estado: row.reporteEstado,
      autor: {
        id: row.autorReporteId,
        nombreCompleto: row.autorReporteNombre,
      },
    },
    evidencia: row.evidenciaId ? {
      id: row.evidenciaId,
      nombreOriginal: row.evidenciaNombreOriginal,
      mimeType: row.evidenciaMimeType,
      extension: row.evidenciaExtension,
      pesoBytes: Number(row.evidenciaPesoBytes),
      fechaSubida: row.evidenciaFechaSubida,
      endpoint: `/api/v1/reclamaciones/${row.id}/evidencia`,
    } : null,
  };
}

function canAccessClaim(row, actor) {
  return String(actor.id) === row.reclamanteId ||
    String(actor.id) === row.autorReporteId ||
    actor.rol === 'Administrador';
}

function assertClaimAccess(row, actor) {
  if (!canAccessClaim(row, actor)) {
    throw new ApiError(403, 'FORBIDDEN', 'No tienes permiso para consultar esta reclamación.');
  }
}

function formatClaimList(result, page, limit) {
  return {
    items: result.rows.map(toPublicClaim),
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    },
  };
}

async function listClaimsForReport(reportId, { page, limit }, actor) {
  const report = await claimRepository.findReportOwner(reportId);
  if (!report) throw new ApiError(404, 'REPORT_NOT_FOUND', 'El reporte solicitado no existe.');
  if (String(actor.id) !== report.ownerId && actor.rol !== 'Administrador') {
    throw new ApiError(403, 'FORBIDDEN', 'Solo el autor del reporte o un administrador puede consultar sus reclamaciones.');
  }
  return formatClaimList(await claimRepository.listClaimsForReport({ reportId, page, limit }), page, limit);
}

async function listMyClaims(userId, { page, limit }) {
  return formatClaimList(await claimRepository.listClaimsForUser({ userId, page, limit }), page, limit);
}

async function getClaim(id, actor) {
  const row = await claimRepository.findClaimById(id);
  if (!row) throw new ApiError(404, 'CLAIM_NOT_FOUND', 'La reclamación solicitada no existe.');
  assertClaimAccess(row, actor);
  return toPublicClaim(row);
}

async function getClaimEvidence(id, actor) {
  const row = await claimRepository.findClaimById(id);
  if (!row) throw new ApiError(404, 'CLAIM_NOT_FOUND', 'La reclamación solicitada no existe.');
  assertClaimAccess(row, actor);
  if (!row.evidenciaId || !row.evidenciaNombreFisico) {
    throw new ApiError(404, 'EVIDENCE_NOT_FOUND', 'La evidencia de esta reclamación no está disponible.');
  }
  return {
    path: resolvePrivateEvidencePath(row.evidenciaNombreFisico),
    mimeType: row.evidenciaMimeType,
  };
}

async function decideClaim(id, status, actor) {
  const row = await claimRepository.decideClaim({ id, status, actor });
  return toPublicClaim(row);
}

module.exports = {
  createClaim,
  toEvidenceMetadata,
  toPublicClaim,
  listClaimsForReport,
  listMyClaims,
  getClaim,
  getClaimEvidence,
  decideClaim,
};
