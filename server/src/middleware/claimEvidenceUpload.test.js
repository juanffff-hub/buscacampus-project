const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const express = require('express');
const app = require('../app');
const errorHandler = require('./errorHandler');
const {
  PRIVATE_UPLOADS_DIR,
  MAX_FILE_SIZE,
  uploadClaimEvidence,
  verifyClaimEvidence,
  deletePrivateEvidenceFile,
  resolvePrivateEvidencePath,
} = require('./claimEvidenceUpload');

const uploadHarness = express();
uploadHarness.post('/upload', uploadClaimEvidence, verifyClaimEvidence, (req, res) => {
  res.status(201).json({
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
});
uploadHarness.use(errorHandler);

async function withServer(targetApp, run) {
  const server = targetApp.listen(0);
  try {
    await new Promise(resolve => server.once('listening', resolve));
    return await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

function multipartFile(buffer, mimeType, name = 'evidencia.bin') {
  const form = new FormData();
  form.append('archivo', new Blob([buffer], { type: mimeType }), name);
  return form;
}

test('guarda evidencia con UUID en directorio privado y no la sirve desde /uploads', async () => {
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x11]);
  let filename;
  try {
    await withServer(uploadHarness, async uploadUrl => {
      const response = await fetch(`${uploadUrl}/upload`, {
        method: 'POST',
        body: multipartFile(bytes, 'image/png', 'C:\\fakepath\\prueba.png'),
      });
      const result = await response.json();
      assert.equal(response.status, 201);
      assert.match(result.filename, /^[0-9a-f-]{36}\.png$/i);
      assert.equal(result.originalName, 'prueba.png');
      assert.equal(result.mimeType, 'image/png');
      assert.equal(result.size, bytes.length);
      filename = result.filename;
      assert.deepEqual(await fs.readFile(resolvePrivateEvidencePath(filename)), bytes);
      assert.equal(resolvePrivateEvidencePath(filename).startsWith(PRIVATE_UPLOADS_DIR), true);
    });

    await withServer(app, async appUrl => {
      const response = await fetch(`${appUrl}/uploads/${filename}`);
      assert.equal(response.status, 404);
    });
  } finally {
    if (filename) await deletePrivateEvidenceFile(filename);
  }
});

test('rechaza MIME no permitido y contenido cuya firma no coincide, y limpia el archivo', async () => {
  const originalRandomUUID = crypto.randomUUID;
  const invalidId = 'aa000000-0000-4000-8000-000000000001';
  const invalidName = `${invalidId}.png`;
  await assert.rejects(fs.access(resolvePrivateEvidencePath(invalidName)), { code: 'ENOENT' });
  crypto.randomUUID = () => invalidId;
  try {
    await withServer(uploadHarness, async url => {
      const unsupported = await fetch(`${url}/upload`, {
        method: 'POST',
        body: multipartFile(Buffer.from('not an image'), 'image/gif', 'evidence.gif'),
      });
      assert.equal(unsupported.status, 400);
      assert.equal((await unsupported.json()).error.code, 'UNSUPPORTED_FILE_TYPE');

      const invalid = await fetch(`${url}/upload`, {
        method: 'POST',
        body: multipartFile(Buffer.from('not a png'), 'image/png', 'fake.png'),
      });
      const body = await invalid.json();
      assert.equal(invalid.status, 400);
      assert.equal(body.error.code, 'INVALID_IMAGE_CONTENT');
      assert.doesNotMatch(JSON.stringify(body), /private_uploads|[A-Z]:\\/i);
    });
    await assert.rejects(fs.access(resolvePrivateEvidencePath(invalidName)), { code: 'ENOENT' });
  } finally {
    crypto.randomUUID = originalRandomUUID;
    await deletePrivateEvidenceFile(invalidName);
  }
});

test('limita evidencia a 5 MB, convierte Multer a 413 y no deja archivos parciales', async () => {
  const originalRandomUUID = crypto.randomUUID;
  const largeId = 'aa000000-0000-4000-8000-000000000002';
  const largeName = `${largeId}.jpg`;
  await assert.rejects(fs.access(resolvePrivateEvidencePath(largeName)), { code: 'ENOENT' });
  crypto.randomUUID = () => largeId;
  const tooLarge = Buffer.alloc(MAX_FILE_SIZE + 1);
  tooLarge.set([0xff, 0xd8, 0xff]);
  try {
    await withServer(uploadHarness, async url => {
      const response = await fetch(`${url}/upload`, {
        method: 'POST',
        body: multipartFile(tooLarge, 'image/jpeg', 'large.jpg'),
      });
      const body = await response.json();
      assert.equal(response.status, 413);
      assert.equal(body.error.code, 'FILE_TOO_LARGE');
      assert.equal(body.error.message, 'La evidencia no puede superar 5 MB.');
    });
    await assert.rejects(fs.access(resolvePrivateEvidencePath(largeName)), { code: 'ENOENT' });
  } finally {
    crypto.randomUUID = originalRandomUUID;
    await deletePrivateEvidenceFile(largeName);
  }
});

test('rechaza nombres físicos que podrían salir de la carpeta privada', () => {
  assert.throws(() => resolvePrivateEvidencePath('../secret.txt'), TypeError);
  assert.throws(() => resolvePrivateEvidencePath('C:\\secret.png'), TypeError);
});
