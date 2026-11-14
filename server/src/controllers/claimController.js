const ApiError = require('../errors/ApiError');
const fs = require('node:fs/promises');
const claimService = require('../services/claimService');
const { createClaimSchema, claimIdSchema, listClaimsSchema, claimDecisionSchema } = require('../schemas/claimSchemas');
const { reportIdSchema } = require('../schemas/reportSchemas');
const { sendSuccess } = require('../utils/responses');
const { deletePrivateEvidenceFile } = require('../middleware/claimEvidenceUpload');

async function create(req, res) {
  try {
    const reportId = reportIdSchema.parse(req.params.id);
    const input = createClaimSchema.parse(req.body);
    if (!req.file) {
      throw new ApiError(400, 'EVIDENCE_REQUIRED', 'Adjunta una imagen como evidencia de la reclamación.');
    }

    const reclamacion = await claimService.createClaim({
      reportId,
      userId: req.user.id,
      message: input.mensajePrueba,
      uploadedFile: req.file,
    });
    return sendSuccess(res, { reclamacion }, 201);
  } catch (error) {
    if (req.file) {
      try {
        await deletePrivateEvidenceFile(req.file.filename);
      } catch {
        // Preserve the sanitized API error.
      }
    }
    throw error;
  }
}

async function listByReport(req, res) {
  const reportId = reportIdSchema.parse(req.params.id);
  const pagination = listClaimsSchema.parse(req.query);
  const result = await claimService.listClaimsForReport(reportId, pagination, req.user);
  return sendSuccess(res, result);
}

async function listMine(req, res) {
  const pagination = listClaimsSchema.parse(req.query);
  const result = await claimService.listMyClaims(req.user.id, pagination);
  return sendSuccess(res, result);
}

async function listReceived(req, res) {
  const pagination = listClaimsSchema.parse(req.query);
  const result = await claimService.listReceivedClaims(req.user, pagination);
  return sendSuccess(res, result);
}

async function getById(req, res) {
  const id = claimIdSchema.parse(req.params.id);
  const reclamacion = await claimService.getClaim(id, req.user);
  return sendSuccess(res, { reclamacion });
}

async function getEvidence(req, res, next) {
  const id = claimIdSchema.parse(req.params.id);
  const evidence = await claimService.getClaimEvidence(id, req.user);
  try {
    await fs.access(evidence.path);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new ApiError(404, 'EVIDENCE_NOT_FOUND', 'La evidencia de esta reclamación no está disponible.');
    }
    throw error;
  }

  res.set({
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': 'inline',
  });
  res.type(evidence.mimeType);
  return res.sendFile(evidence.path, { dotfiles: 'deny' }, error => {
    if (!error || res.headersSent) return;
    if (error.code === 'ENOENT') {
      return next(new ApiError(404, 'EVIDENCE_NOT_FOUND', 'La evidencia de esta reclamación no está disponible.'));
    }
    return next(new ApiError(500, 'INTERNAL_SERVER_ERROR', 'Ocurrió un error inesperado.'));
  });
}

async function updateStatus(req, res) {
  const id = claimIdSchema.parse(req.params.id);
  const input = claimDecisionSchema.parse(req.body);
  const reclamacion = await claimService.decideClaim(id, input.estado, req.user);
  return sendSuccess(res, { reclamacion });
}

module.exports = { create, listByReport, listMine, listReceived, getById, getEvidence, updateStatus };
