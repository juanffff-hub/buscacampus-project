const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const multer = require('multer');
const ApiError = require('../errors/ApiError');
const { sanitizeOriginalName } = require('./reportUpload');

const PRIVATE_UPLOADS_DIR = path.resolve(__dirname, '../../private_uploads');
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MIME_TO_EXTENSION = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
});
const MIME_TO_SOURCE_EXTENSIONS = Object.freeze({
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
});
const PHYSICAL_NAME_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

function ensurePrivateDirectory() {
  return fs.mkdir(PRIVATE_UPLOADS_DIR, { recursive: true });
}

function resolvePrivateEvidencePath(filename) {
  if (typeof filename !== 'string' || !PHYSICAL_NAME_PATTERN.test(filename)) {
    throw new TypeError('Invalid stored evidence name.');
  }
  const resolved = path.resolve(PRIVATE_UPLOADS_DIR, filename);
  if (path.dirname(resolved) !== PRIVATE_UPLOADS_DIR) {
    throw new TypeError('Invalid stored evidence path.');
  }
  return resolved;
}

async function deletePrivateEvidenceFile(filename) {
  const filePath = resolvePrivateEvidencePath(filename);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    ensurePrivateDirectory().then(
      () => callback(null, PRIVATE_UPLOADS_DIR),
      callback,
    );
  },
  filename: (_req, file, callback) => {
    const extension = MIME_TO_EXTENSION[file.mimetype];
    if (!extension) {
      return callback(new ApiError(
        400,
        'UNSUPPORTED_FILE_TYPE',
        'La evidencia debe ser una imagen JPEG, PNG o WebP.',
      ));
    }
    return callback(null, `${crypto.randomUUID()}${extension}`);
  },
});

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

function mapMulterError(error) {
  if (!(error instanceof multer.MulterError)) return error;
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new ApiError(413, 'FILE_TOO_LARGE', 'La evidencia no puede superar 5 MB.');
  }
  return new ApiError(400, 'INVALID_MULTIPART_REQUEST', 'La solicitud multipart no es válida.');
}

function uploadClaimEvidence(req, res, next) {
  multerUpload.single('archivo')(req, res, error => {
    if (error) return next(mapMulterError(error));
    return next();
  });
}

function hasValidImageSignature(buffer, mimeType) {
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  if (mimeType === 'image/webp') {
    return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

function verifyClaimEvidence(req, res, next) {
  if (!req.file) return next();

  (async () => {
    const filePath = resolvePrivateEvidencePath(req.file.filename);
    const content = await fs.readFile(filePath);
    if (!hasValidImageSignature(content, req.file.mimetype)) {
      throw new ApiError(
        400,
        'INVALID_IMAGE_CONTENT',
        'El contenido no coincide con el tipo de evidencia declarado.',
      );
    }
  })().then(
    () => next(),
    async error => {
      try {
        await deletePrivateEvidenceFile(req.file.filename);
      } catch {
        // Return only the validation or I/O error through the sanitized handler.
      }
      return next(error);
    },
  );
}

module.exports = {
  PRIVATE_UPLOADS_DIR,
  MAX_FILE_SIZE,
  MIME_TO_EXTENSION,
  uploadClaimEvidence,
  verifyClaimEvidence,
  deletePrivateEvidenceFile,
  resolvePrivateEvidencePath,
  sanitizeOriginalName,
};
