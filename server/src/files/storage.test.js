const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const storage = require('./storage');

test('el almacenamiento común valida nombres, stagea, restaura y purga dentro de su raíz', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'buscacampus-storage-'));
  const filename = `${crypto.randomUUID()}.png`;
  const original = Buffer.from('test image');
  try {
    await storage.ensureStorageDirectory(root);
    const source = storage.resolveStoredFilePath(root, filename);
    await fs.writeFile(source, original);

    const staged = await storage.stageStoredFiles(root, [filename]);
    assert.equal(staged.length, 1);
    await assert.rejects(fs.access(source), { code: 'ENOENT' });
    assert.deepEqual(
      await fs.readFile(storage.resolveStagedFilePath(root, staged[0].stagedName)),
      original,
    );

    await storage.restoreStagedFiles(root, staged);
    assert.deepEqual(await fs.readFile(source), original);

    const stagedForPurge = await storage.stageStoredFiles(root, [filename]);
    const result = await storage.purgeStagedFiles(root, stagedForPurge, 'test image');
    assert.deepEqual(result, { removed: 1, failed: 0 });
    await assert.rejects(fs.access(source), { code: 'ENOENT' });
  } finally {
    if (path.dirname(path.resolve(root)) === path.resolve(os.tmpdir())) {
      await fs.rm(root, { recursive: true, force: true });
    }
  }
});

test('el almacenamiento común rechaza rutas externas y normaliza nombres originales', () => {
  assert.throws(() => storage.resolveStoredFilePath(os.tmpdir(), '../secret.png'), TypeError);
  assert.throws(() => storage.resolveStagedFilePath(os.tmpdir(), '../secret'), TypeError);
  assert.equal(storage.sanitizeOriginalName('C:\\fakepath\\foto.jpg'), 'foto.jpg');
  assert.equal(storage.sanitizeOriginalName(''), 'imagen');
});
