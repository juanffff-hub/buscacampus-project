const path = require('node:path');
const multer = require('multer');
const ApiError = require('../errors/ApiError');
const fileStorage = require('../files/storage');

const UPLOADS_DIR = path.resolve(
  process.env.BUSCACAMPUS_UPLOADS_DIR || path.resolve(__dirname, '../../uploads'),
);
const MAX_FILE_SIZE = fileStorage.MAX_IMAGE_SIZE;
const MIME_TO_EXTENSION = fileStorage.MIME_TO_EXTENSION;
const MIME_TO_SOURCE_EXTENSIONS = Object.freeze({
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
});

const storage = fileStorage.createUuidDiskStorage(UPLOADS_DIR);
const multerUpload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 7,
    parts: 8,
    fieldSize: 20 * 1024,
    fieldNameSize: 100,
  },
  fileFilter: (_req, file, callback) => {
    if (!MIME_TO_EXTENSION[file.mimetype]) {
      return callback(new ApiError(
        400,
        'UNSUPPORTED_FILE_TYPE',
        'El archivo debe ser una imagen JPEG, PNG o WebP.',
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

function deleteUploadedFile(filename) {
  return fileStorage.deleteStoredFile(UPLOADS_DIR, filename);
}

function stageUploadedFiles(filenames) {
  return fileStorage.stageStoredFiles(UPLOADS_DIR, filenames);
}

function restoreStagedFiles(staged) {
  return fileStorage.restoreStagedFiles(UPLOADS_DIR, staged);
}

function purgeStagedFiles(staged) {
  return fileStorage.purgeStagedFiles(UPLOADS_DIR, staged, 'report image');
}

function resolveUploadPath(filename) {
  return fileStorage.resolveStoredFilePath(UPLOADS_DIR, filename);
}

function sanitizeOriginalName(originalName) {
  return fileStorage.sanitizeOriginalName(originalName);
}

function uploadReportImage(req, res, next) {
  multerUpload.single('archivo')(req, res, error => {
    if (error) return next(fileStorage.mapMulterError(error));
    return next();
  });
}

function verifyUploadedImage(req, res, next) {
  return fileStorage.verifyImageSignature(req, res, next, {
    directory: UPLOADS_DIR,
    deleteFile: deleteUploadedFile,
    message: 'El contenido no coincide con el tipo de imagen declarado.',
  });
}

module.exports = {
  UPLOADS_DIR,
  MAX_FILE_SIZE,
  MIME_TO_EXTENSION,
  deleteUploadedFile,
  stageUploadedFiles,
  restoreStagedFiles,
  purgeStagedFiles,
  resolveUploadPath,
  sanitizeOriginalName,
  uploadReportImage,
  verifyUploadedImage,
  hasValidImageSignature: fileStorage.hasValidImageSignature,
};
