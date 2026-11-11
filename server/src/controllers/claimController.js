const ApiError = require('../errors/ApiError');
const claimService = require('../services/claimService');
const { createClaimSchema } = require('../schemas/claimSchemas');
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

module.exports = { create };
