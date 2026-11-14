const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { diagnoseFileStorage } = require('./storageDiagnostics');

async function createTempDirectory() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'buscacampus-diagnostics-'));
}

test('diagnóstico de almacenamiento detecta discrepancias sin alterar archivos', async () => {
  const root = await createTempDirectory();
  const publicDirectory = path.join(root, 'uploads');
  const privateDirectory = path.join(root, 'private_uploads');
  const existingReportImage = `${crypto.randomUUID()}.png`;
  const missingReportImage = `${crypto.randomUUID()}.jpg`;
  const privateEvidence = `${crypto.randomUUID()}.webp`;
  const orphanImage = `${crypto.randomUUID()}.jpg`;
  const stagedName = `.deleting-${crypto.randomUUID()}`;
  try {
    await fs.mkdir(publicDirectory, { recursive: true });
    await fs.mkdir(privateDirectory, { recursive: true });
    await fs.writeFile(path.join(publicDirectory, existingReportImage), 'image');
    await fs.writeFile(path.join(publicDirectory, orphanImage), 'orphan');
    await fs.writeFile(path.join(publicDirectory, stagedName), 'staged');
    await fs.writeFile(path.join(privateDirectory, privateEvidence), 'private image');

    const beforePublic = (await fs.readdir(publicDirectory)).sort();
    const beforePrivate = (await fs.readdir(privateDirectory)).sort();
    const diagnosis = await diagnoseFileStorage({
      query: async () => ({ rows: [
        { storage: 'report', filename: existingReportImage },
        { storage: 'report', filename: missingReportImage },
        { storage: 'claimEvidence', filename: privateEvidence },
        { storage: 'report', filename: '../unsafe' },
      ] }),
      publicDirectory,
      privateDirectory,
    });

    assert.equal(diagnosis.status, 'mismatch');
    assert.equal(diagnosis.readOnly, true);
    assert.equal(diagnosis.invalidMetadataNames, 1);
    assert.deepEqual(diagnosis.reportImages, {
      directoryPresent: true,
      metadataFiles: 2,
      missingFiles: 1,
      orphanFiles: 1,
      stagedFiles: 1,
      unexpectedFiles: 0,
    });
    assert.deepEqual(diagnosis.claimEvidence, {
      directoryPresent: true,
      metadataFiles: 1,
      missingFiles: 0,
      orphanFiles: 0,
      stagedFiles: 0,
      unexpectedFiles: 0,
    });
    assert.deepEqual((await fs.readdir(publicDirectory)).sort(), beforePublic);
    assert.deepEqual((await fs.readdir(privateDirectory)).sort(), beforePrivate);
  } finally {
    if (path.dirname(path.resolve(root)) === path.resolve(os.tmpdir())) {
      await fs.rm(root, { recursive: true, force: true });
    }
  }
});

test('diagnóstico informa directorios ausentes sin intentar crearlos', async () => {
  const root = await createTempDirectory();
  try {
    const diagnosis = await diagnoseFileStorage({
      query: async () => ({ rows: [] }),
      publicDirectory: path.join(root, 'uploads'),
      privateDirectory: path.join(root, 'private_uploads'),
    });
    assert.equal(diagnosis.status, 'ok');
    assert.equal(diagnosis.reportImages.directoryPresent, false);
    assert.equal(diagnosis.claimEvidence.directoryPresent, false);
    assert.deepEqual(await fs.readdir(root), []);
  } finally {
    if (path.dirname(path.resolve(root)) === path.resolve(os.tmpdir())) {
      await fs.rm(root, { recursive: true, force: true });
    }
  }
});
