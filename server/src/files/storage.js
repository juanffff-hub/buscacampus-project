const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const multer = require('multer');
const ApiError = require('../errors/ApiError');

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MIME_TO_EXTENSION = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
});
const PHYSICAL_NAME_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;
const STAGED_NAME_PATTERN = /^\.deleting-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ensureStorageDirectory(directory) {
  return fs.mkdir(path.resolve(directory), { recursive: true });
}

function resolveStoredFilePath(directory, filename) {
  const root = path.resolve(directory);
  if (typeof filename !== 'string' || !PHYSICAL_NAME_PATTERN.test(filename)) {
    throw new TypeError('Invalid stored file name.');
  }
  const resolved = path.resolve(root, filename);
  if (path.dirname(resolved) !== root) {
    throw new TypeError('Invalid stored file path.');
  }
  return resolved;
}

function resolveStagedFilePath(directory, stagedName) {
  const root = path.resolve(directory);
  if (typeof stagedName !== 'string' || !STAGED_NAME_PATTERN.test(stagedName)) {
    throw new TypeError('Invalid staged file name.');
  }
  const resolved = path.resolve(root, stagedName);
  if (path.dirname(resolved) !== root) {
    throw new TypeError('Invalid staged file path.');
  }
  return resolved;
}

function createUuidDiskStorage(directory, unsupportedMessage = 'El archivo debe ser una imagen JPEG, PNG o WebP.') {
  const root = path.resolve(directory);
  return multer.diskStorage({
    destination: (_req, _file, callback) => {
      ensureStorageDirectory(root).then(() => callback(null, root), callback);
    },
    filename: (_req, file, callback) => {
      const extension = MIME_TO_EXTENSION[file.mimetype];
      if (!extension) {
        return callback(new ApiError(400, 'UNSUPPORTED_FILE_TYPE', unsupportedMessage));
      }
      return callback(null, `${crypto.randomUUID()}${extension}`);
    },
  });
}

async function deleteStoredFile(directory, filename) {
  const filePath = resolveStoredFilePath(directory, filename);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function restoreStagedFiles(directory, staged) {
  for (const file of staged) {
    try {
      await fs.rename(
        resolveStagedFilePath(directory, file.stagedName),
        resolveStoredFilePath(directory, file.filename),
      );
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

async function stageStoredFiles(directory, filenames) {
  const staged = [];
  try {
    for (const filename of filenames) {
      const stagedName = `.deleting-${crypto.randomUUID()}`;
      try {
        await fs.rename(
          resolveStoredFilePath(directory, filename),
          resolveStagedFilePath(directory, stagedName),
        );
        staged.push({ filename, stagedName });
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }
    }
    return staged;
  } catch (error) {
    try {
      await restoreStagedFiles(directory, staged);
    } catch {
      // Keep the original error; all staged paths remain inside the configured root.
    }
    throw error;
  }
}

async function purgeStagedFiles(directory, staged, fileKind = 'stored file') {
  const failures = [];
  for (const file of staged) {
    try {
      await fs.unlink(resolveStagedFilePath(directory, file.stagedName));
    } catch (error) {
      if (error.code !== 'ENOENT') failures.push(error);
    }
  }
  if (failures.length) {
    console.error(`Could not finish removing a ${fileKind} after the database commit.`);
  }
  return { removed: staged.length - failures.length, failed: failures.length };
}

function sanitizeOriginalName(originalName, fallback = 'imagen') {
  const normalized = String(originalName || '')
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 255);
  return normalized || fallback;
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

function mapMulterError(error, { fileTooLargeMessage = 'La imagen no puede superar 5 MB.' } = {}) {
  if (!(error instanceof multer.MulterError)) return error;
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new ApiError(413, 'FILE_TOO_LARGE', fileTooLargeMessage);
  }
  return new ApiError(400, 'INVALID_MULTIPART_REQUEST', 'La solicitud multipart no es válida.');
}

function verifyImageSignature(req, res, next, { directory, deleteFile, message }) {
  if (!req.file) return next();

  (async () => {
    const filePath = resolveStoredFilePath(directory, req.file.filename);
    const content = await fs.readFile(filePath);
    if (!hasValidImageSignature(content, req.file.mimetype)) {
      throw new ApiError(400, 'INVALID_IMAGE_CONTENT', message);
    }
  })().then(
    () => next(),
    async error => {
      try {
        await deleteFile(req.file.filename);
      } catch {
        // Do not replace the validation error with filesystem details.
      }
      return next(error);
    },
  );
}

module.exports = {
  MAX_IMAGE_SIZE,
  MIME_TO_EXTENSION,
  PHYSICAL_NAME_PATTERN,
  ensureStorageDirectory,
  resolveStoredFilePath,
  resolveStagedFilePath,
  createUuidDiskStorage,
  deleteStoredFile,
  stageStoredFiles,
  restoreStagedFiles,
  purgeStagedFiles,
  sanitizeOriginalName,
  hasValidImageSignature,
  mapMulterError,
  verifyImageSignature,
};
