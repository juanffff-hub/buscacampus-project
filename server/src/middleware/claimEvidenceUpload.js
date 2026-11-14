const path = require('node:path');
const multer = require('multer');
const ApiError = require('../errors/ApiError');
const fileStorage = require('../files/storage');

const PRIVATE_UPLOADS_DIR = path.resolve(
  process.env.BUSCACAMPUS_PRIVATE_UPLOADS_DIR || path.resolve(__dirname, '../../private_uploads'),
);
const MAX_FILE_SIZE = fileStorage.MAX_IMAGE_SIZE;
const MIME_TO_EXTENSION = fileStorage.MIME_TO_EXTENSION;
const MIME_TO_SOURCE_EXTENSIONS = Object.freeze({
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
});

const storage = fileStorage.createUuidDiskStorage(
  PRIVATE_UPLOADS_DIR,
  'La evidencia debe ser una imagen JPEG, PNG o WebP.',
);
const multerUpload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 1,
    parts: 2,
    fieldSize: 20 * 1024,
    fieldNameSize: 100,
  },
  fileFilter: (_req, file, callback) => {
    if (!MIME_TO_EXTENSION[file.mimetype]) {
      return callback(new ApiError(
        400,
        'UNSUPPORTED_FILE_TYPE',
        'La evidencia debe ser una imagen JPEG, PNG o WebP.',
      ));
    }
    const sourceExtension = path.extname(file.originalname || '').toLowerCase();
    if (!MIME_TO_SOURCE_EXTENSIONS[file.mimetype].includes(sourceExtension)) {
      return callback(new ApiError(
        400,
        'UNSUPPORTED_FILE_EXTENSION',
        'La extensión del archivo debe coincidir con su tipo de imagen.',
      ));
    }
    return callback(null, true);
  },
});

function resolvePrivateEvidencePath(filename) {
  return fileStorage.resolveStoredFilePath(PRIVATE_UPLOADS_DIR, filename);
}

function deletePrivateEvidenceFile(filename) {
  return fileStorage.deleteStoredFile(PRIVATE_UPLOADS_DIR, filename);
}

function uploadClaimEvidence(req, res, next) {
  multerUpload.single('archivo')(req, res, error => {
    if (error) {
      return next(fileStorage.mapMulterError(error, {
        fileTooLargeMessage: 'La evidencia no puede superar 5 MB.',
      }));
    }
    return next();
  });
}

function verifyClaimEvidence(req, res, next) {
  return fileStorage.verifyImageSignature(req, res, next, {
    directory: PRIVATE_UPLOADS_DIR,
    deleteFile: deletePrivateEvidenceFile,
    message: 'El contenido no coincide con el tipo de evidencia declarado.',
  });
}

module.exports = {
  PRIVATE_UPLOADS_DIR,
  MAX_FILE_SIZE,
  MIME_TO_EXTENSION,
  uploadClaimEvidence,
  verifyClaimEvidence,
  deletePrivateEvidenceFile,
  resolvePrivateEvidencePath,
  sanitizeOriginalName: fileStorage.sanitizeOriginalName,
};
