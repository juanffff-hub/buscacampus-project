const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const multer = require('multer');
const ApiError = require('../errors/ApiError');

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MIME_TO_EXTENSION = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
});
const PHYSICAL_NAME_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

function ensureUploadsDirectory() {
  return fs.mkdir(UPLOADS_DIR, { recursive: true });
}

function resolveUploadPath(filename) {
  if (typeof filename !== 'string' || !PHYSICAL_NAME_PATTERN.test(filename)) {
    throw new TypeError('Invalid stored upload name.');
  }
  const resolved = path.resolve(UPLOADS_DIR, filename);
  if (path.dirname(resolved) !== UPLOADS_DIR) {
    throw new TypeError('Invalid stored upload path.');
  }
  return resolved;
}

function resolveStagedPath(filename) {
  if (typeof filename !== 'string' || !/^\.deleting-[0-9a-f-]{36}$/i.test(filename)) {
    throw new TypeError('Invalid staged upload name.');
  }
  const resolved = path.resolve(UPLOADS_DIR, filename);
  if (path.dirname(resolved) !== UPLOADS_DIR) {
    throw new TypeError('Invalid staged upload path.');
  }
  return resolved;
}

async function deleteUploadedFile(filename) {
  const filePath = resolveUploadPath(filename);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function stageUploadedFiles(filenames) {
  const staged = [];
  try {
    for (const filename of filenames) {
      const stagedName = `.deleting-${crypto.randomUUID()}`;
      try {
        await fs.rename(resolveUploadPath(filename), resolveStagedPath(stagedName));
        staged.push({ filename, stagedName });
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }
    }
    return staged;
  } catch (error) {
    try {
      await restoreStagedFiles(staged);
    } catch {
      // Preserve the original staging error; paths stay inside uploads/.
    }
    throw error;
  }
}

async function restoreStagedFiles(staged) {
  for (const file of staged) {
    try {
      await fs.rename(resolveStagedPath(file.stagedName), resolveUploadPath(file.filename));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

async function purgeStagedFiles(staged) {
  const failures = [];
  for (const file of staged) {
    try {
      await fs.unlink(resolveStagedPath(file.stagedName));
    } catch (error) {
      if (error.code !== 'ENOENT') failures.push(error);
    }
  }
  if (failures.length) {
    console.error('Could not finish removing a report image after the database commit.');
  }
}

function sanitizeOriginalName(originalName) {
  const normalized = String(originalName || '')
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 255);
  return normalized || 'imagen';
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    ensureUploadsDirectory().then(
      () => callback(null, UPLOADS_DIR),
      callback,
    );
  },
  filename: (_req, file, callback) => {
    const extension = MIME_TO_EXTENSION[file.mimetype];
    if (!extension) {
      return callback(new ApiError(
        400,
        'UNSUPPORTED_FILE_TYPE',
        'El archivo debe ser una imagen JPEG, PNG o WebP.',
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
    return callback(null, true);
  },
});

function mapMulterError(error) {
  if (!(error instanceof multer.MulterError)) return error;
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new ApiError(413, 'FILE_TOO_LARGE', 'La imagen no puede superar 5 MB.');
  }
  return new ApiError(400, 'INVALID_MULTIPART_REQUEST', 'La solicitud multipart no es válida.');
}

function uploadReportImage(req, res, next) {
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

function verifyUploadedImage(req, res, next) {
  if (!req.file) return next();

  (async () => {
    const filePath = resolveUploadPath(req.file.filename);
    const content = await fs.readFile(filePath);
    if (!hasValidImageSignature(content, req.file.mimetype)) {
      throw new ApiError(400, 'INVALID_IMAGE_CONTENT', 'El contenido no coincide con el tipo de imagen declarado.');
    }
  })().then(
    () => next(),
    async error => {
      try {
        await deleteUploadedFile(req.file.filename);
      } catch {
        // Preserve the validation or file-read error returned to the client.
      }
      return next(error);
    },
  );
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
  hasValidImageSignature,
};
