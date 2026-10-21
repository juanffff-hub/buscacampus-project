const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const express = require('express');
const app = require('../app');
const errorHandler = require('./errorHandler');
const {
  UPLOADS_DIR,
  MAX_FILE_SIZE,
  deleteUploadedFile,
  resolveUploadPath,
  sanitizeOriginalName,
  uploadReportImage,
  verifyUploadedImage,
} = require('./reportUpload');

const uploadHarness = express();
uploadHarness.post('/upload', uploadReportImage, verifyUploadedImage, (req, res) => {
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

function multipartFile(buffer, mimeType, name = 'campus-image.bin') {
  const form = new FormData();
  form.append('archivo', new Blob([buffer], { type: mimeType }), name);
  return form;
}

async function storedFileNames() {
  return (await fs.readdir(UPLOADS_DIR)).filter(name => name !== '.gitkeep');
}

test('almacena JPEG, PNG y WebP con UUID, extensión MIME y acceso estático /uploads', async () => {
  const images = [
    {
      mime: 'image/jpeg',
      original: 'C:\\fakepath\\foto-original.png',
      sanitizedOriginal: 'foto-original.png',
      bytes: Buffer.from([0xff, 0xd8, 0xff, 0x10, 0x20]),
    },
    {
      mime: 'image/png',
      original: 'foto-original.png',
      sanitizedOriginal: 'foto-original.png',
      bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x11]),
    },
    {
      mime: 'image/webp',
      original: 'foto-original.webp',
      sanitizedOriginal: 'foto-original.webp',
      bytes: Buffer.from('RIFF0000WEBPdata', 'ascii'),
    },
  ];
  const storedNames = [];

  try {
    await withServer(uploadHarness, async uploadUrl => {
      for (const image of images) {
        const response = await fetch(`${uploadUrl}/upload`, {
          method: 'POST',
          body: multipartFile(image.bytes, image.mime, image.original),
        });
        const result = await response.json();
        assert.equal(response.status, 201);
        assert.match(result.filename, /^[0-9a-f-]{36}\.(jpg|png|webp)$/i);
        assert.ok(result.filename.endsWith(`.${image.mime.split('/')[1].replace('jpeg', 'jpg')}`));
        assert.equal(result.originalName, image.sanitizedOriginal);
        assert.equal(result.mimeType, image.mime);
        assert.equal(result.size, image.bytes.length);
        storedNames.push(result.filename);

        const fullPath = resolveUploadPath(result.filename);
        assert.deepEqual(await fs.readFile(fullPath), image.bytes);
      }
    });

    await withServer(app, async appUrl => {
      for (const name of storedNames) {
        const response = await fetch(`${appUrl}/uploads/${name}`);
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type'), /^image\//);
      }
    });
  } finally {
    await Promise.all(storedNames.map(deleteUploadedFile));
  }
});

test('rechaza MIME no permitido y contenido cuya firma no coincide', async () => {
  const before = await storedFileNames();
  await withServer(uploadHarness, async url => {
    const unsupportedResponse = await fetch(`${url}/upload`, {
      method: 'POST',
      body: multipartFile(Buffer.from('not an image'), 'image/gif', 'anim.gif'),
    });
    const unsupportedBody = await unsupportedResponse.json();
    assert.equal(unsupportedResponse.status, 400);
    assert.equal(unsupportedBody.error.code, 'UNSUPPORTED_FILE_TYPE');

    const invalidContentResponse = await fetch(`${url}/upload`, {
      method: 'POST',
      body: multipartFile(Buffer.from('not a png'), 'image/png', 'fake.png'),
    });
    const invalidContentBody = await invalidContentResponse.json();
    assert.equal(invalidContentResponse.status, 400);
    assert.equal(invalidContentBody.error.code, 'INVALID_IMAGE_CONTENT');
  });
  assert.deepEqual(await storedFileNames(), before);
});

test('limita el archivo a 5 MB y convierte el error de Multer a HTTP 413', async () => {
  const before = await storedFileNames();
  const tooLarge = Buffer.alloc(MAX_FILE_SIZE + 1);
  tooLarge.set([0xff, 0xd8, 0xff]);
  await withServer(uploadHarness, async url => {
    const response = await fetch(`${url}/upload`, {
      method: 'POST',
      body: multipartFile(tooLarge, 'image/jpeg', 'large.jpg'),
    });
    const body = await response.json();
    assert.equal(response.status, 413);
    assert.equal(body.error.code, 'FILE_TOO_LARGE');
    assert.equal(body.error.message, 'La imagen no puede superar 5 MB.');
  });
  assert.deepEqual(await storedFileNames(), before);
});

test('no acepta rutas físicas externas y limpia/sanitiza el nombre original', async () => {
  assert.throws(() => resolveUploadPath('../secreto.txt'), TypeError);
  assert.throws(() => resolveUploadPath('C:\\temp\\foto.jpg'), TypeError);
  assert.equal(sanitizeOriginalName('C:\\fakepath\\foto.jpg'), 'foto.jpg');
  assert.equal(sanitizeOriginalName(''), 'imagen');
});
