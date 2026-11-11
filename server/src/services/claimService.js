const path = require('node:path');
const claimRepository = require('../repositories/claimRepository');
const {
  deletePrivateEvidenceFile,
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

module.exports = { createClaim, toEvidenceMetadata };
