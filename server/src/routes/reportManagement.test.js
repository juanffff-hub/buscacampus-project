const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const jwt = require('jsonwebtoken');
const app = require('../app');
const pool = require('../config/database');
const userRepository = require('../repositories/userRepository');
const {
  UPLOADS_DIR,
  deleteUploadedFile,
  resolveUploadPath,
} = require('../middleware/reportUpload');

const SECRET = 'report-management-test-secret-with-thirty-two-bytes';
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x11]);

async function withServer(run) {
  const server = app.listen(0);
  try {
    await new Promise(resolve => server.once('listening', resolve));
    return await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

function makeReportForm({ image = false, overrides = {} } = {}) {
  const form = new FormData();
  const fields = {
    titulo: 'Termo actualizado',
    descripcion: 'Actualización de prueba.',
    categoriaId: '2',
    ubicacionId: '3',
    tipoReporte: 'Encontrado',
    fechaHoraEvento: '2026-10-19T15:00:00.000Z',
    ...overrides,
  };
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  if (image) form.append('archivo', new Blob([PNG_BYTES], { type: 'image/png' }), 'nuevo.png');
  return form;
}

function sessionCookie(id = '7') {
  const token = jwt.sign({ sub: id }, SECRET, { expiresIn: '1m' });
  return `buscacampus_session=${token}`;
}

function makeMetadata(filename, overrides = {}) {
  return {
    id: '101',
    filename,
    originalName: 'anterior.png',
    url: `/uploads/${filename}`,
    mimeType: 'image/png',
    extension: '.png',
    size: PNG_BYTES.length,
    uploadedAt: '2026-10-19T16:00:00.000Z',
    ...overrides,
  };
}

function makeManagementDb({ ownerId = '7', metadata = [], exists = true, failDelete = false } = {}) {
  const state = {
    ownerId,
    metadata: metadata.map(item => ({ ...item })),
    exists,
    failDelete,
    title: 'Termo verde',
    description: 'Encontrado en la biblioteca.',
    categoryId: '2',
    locationId: '3',
    type: 'Encontrado',
    eventDate: '2026-10-19T15:00:00.000Z',
    status: 'Publicado',
    calls: [],
    nextMetadataId: 200,
  };

  const connect = async () => ({
    query: async (sql, values = []) => {
      const statement = sql.trim().replace(/\s+/g, ' ');
      state.calls.push({ statement, values });

      if (statement === 'BEGIN' || statement === 'COMMIT' || statement === 'ROLLBACK') {
        return { rows: [] };
      }
      if (statement.startsWith('SELECT id::text AS id, usuario_creador_id::text AS "ownerId"')) {
        return { rows: state.exists ? [{ id: '91', ownerId: state.ownerId }] : [] };
      }
      if (statement.startsWith('UPDATE reportes_objetos')) {
        state.title = values[0];
        state.description = values[1];
        state.categoryId = values[2];
        state.locationId = values[3];
        state.type = values[4];
        state.eventDate = values[5];
        state.status = values[6] || state.status;
        return { rows: [] };
      }
      if (statement.startsWith('SELECT nombre_fisico AS filename')) {
        return { rows: state.metadata.map(item => ({ filename: item.filename })) };
      }
      if (statement.startsWith('DELETE FROM archivos_metadatos')) {
        state.metadata = [];
        return { rows: [] };
      }
      if (statement.startsWith('INSERT INTO archivos_metadatos')) {
        state.metadata.push({
          id: String(state.nextMetadataId++),
          originalName: values[2],
          filename: values[3],
          url: values[4],
          mimeType: values[5],
          extension: values[6],
          size: values[7],
          uploadedAt: '2026-10-20T12:00:00.000Z',
        });
        return { rows: [] };
      }
      if (statement.includes('JOIN usuarios') && statement.includes('WHERE r.id = $1')) {
        if (!state.exists) return { rows: [] };
        const file = state.metadata[0];
        return {
          rows: [{
            id: '91',
            titulo: state.title,
            descripcion: state.description,
            tipoReporte: state.type,
            estado: state.status,
            fechaHoraEvento: state.eventDate,
            fechaCreacion: '2026-10-19T16:00:00.000Z',
            autorId: state.ownerId,
            autorNombre: 'Ana Pérez',
            categoriaId: state.categoryId,
            categoriaNombre: 'Otros',
            ubicacionId: state.locationId,
            ubicacionNombre: 'Biblioteca',
            imagenId: file?.id || null,
            imagenNombreOriginal: file?.originalName || null,
            imagenNombreFisico: file?.filename || null,
            imagenUrl: file?.url || null,
            imagenMimeType: file?.mimeType || null,
            imagenExtension: file?.extension || null,
            imagenPesoBytes: file ? String(file.size) : null,
            imagenFechaSubida: file?.uploadedAt || null,
          }],
        };
      }
      if (statement.startsWith('DELETE FROM reportes_objetos')) {
        if (state.failDelete) {
          const error = new Error('private foreign key detail');
          error.code = '23503';
          throw error;
        }
        state.exists = false;
        state.metadata = [];
        return { rows: [{ id: '91' }] };
      }
      throw new Error(`Unexpected management query: ${statement}`);
    },
    release() {},
  });

  return { state, connect };
}

async function withManagementContext({ db, role = 'Usuario' }, run) {
  const originalConnect = pool.connect;
  const originalFindById = userRepository.findById;
  const originalSecret = process.env.JWT_SECRET;
  pool.connect = db.connect;
  userRepository.findById = async id => ({
    id,
    nombre_completo: 'Ana Pérez',
    correo_electronico: 'ana@uao.edu.co',
    rol: role,
    estado: 'Activo',
    fecha_registro: '2026-10-19T12:00:00.000Z',
  });
  process.env.JWT_SECRET = SECRET;
  try {
    return await run();
  } finally {
    pool.connect = originalConnect;
    userRepository.findById = originalFindById;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
}

async function writeExistingImage(filename) {
  const filePath = resolveUploadPath(filename);
  await assert.rejects(fs.access(filePath), { code: 'ENOENT' });
  await fs.writeFile(filePath, PNG_BYTES);
  return filePath;
}

async function removeIfPresent(filename) {
  if (!filename) return;
  try {
    await deleteUploadedFile(filename);
  } catch {
    // Test cleanup tolerates files already removed by the API.
  }
}

async function withFixedUuid(id, run) {
  const originalRandomUUID = crypto.randomUUID;
  crypto.randomUUID = () => id;
  try {
    return await run();
  } finally {
    crypto.randomUUID = originalRandomUUID;
  }
}

test('PUT /api/v1/reportes/:id actualiza y reemplaza metadata/archivo solo tras commit', async () => {
  const oldName = '21000000-0000-4000-8000-000000000001.png';
  const newId = '21000000-0000-4000-8000-000000000002';
  const newName = `${newId}.png`;
  const oldPath = await writeExistingImage(oldName);
  const db = makeManagementDb({ metadata: [makeMetadata(oldName)] });
  try {
    await withFixedUuid(newId, () => withManagementContext({ db }, () => withServer(async url => {
      const response = await fetch(`${url}/api/v1/reportes/91`, {
        method: 'PUT',
        headers: { Cookie: sessionCookie() },
        body: makeReportForm({ image: true, overrides: { estado: 'Devuelto' } }),
      });
      const body = await response.json();

      assert.equal(response.status, 200, JSON.stringify(body));
      assert.equal(body.success, true);
      assert.equal(body.data.report.titulo, 'Termo actualizado');
      assert.equal(body.data.report.estado, 'Devuelto');
      assert.equal(body.data.report.imagen.nombreOriginal, 'nuevo.png');
      assert.equal(body.data.report.imagen.nombreFisico, newName);
      assert.deepEqual(db.state.metadata.map(file => file.filename), [newName]);
      assert.deepEqual(db.state.calls.map(call => call.statement.split(' ')[0]), [
        'BEGIN', 'SELECT', 'UPDATE', 'SELECT', 'DELETE', 'INSERT', 'SELECT', 'COMMIT',
      ]);
      await assert.rejects(fs.access(oldPath), { code: 'ENOENT' });
      assert.deepEqual(await fs.readFile(resolveUploadPath(newName)), PNG_BYTES);
    })));
  } finally {
    await removeIfPresent(oldName);
    await removeIfPresent(newName);
  }
});

test('PUT /api/v1/reportes/:id conserva la imagen cuando no se adjunta otra', async () => {
  const existingName = '22000000-0000-4000-8000-000000000001.webp';
  const existingPath = await writeExistingImage(existingName);
  const db = makeManagementDb({ metadata: [makeMetadata(existingName)] });
  try {
    await withManagementContext({ db }, () => withServer(async url => {
      const response = await fetch(`${url}/api/v1/reportes/91`, {
        method: 'PUT',
        headers: { Cookie: sessionCookie() },
        body: makeReportForm({ overrides: { titulo: 'Sin cambiar la foto' } }),
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.data.report.titulo, 'Sin cambiar la foto');
      assert.equal(body.data.report.imagen.nombreFisico, existingName);
      assert.deepEqual(db.state.metadata.map(file => file.filename), [existingName]);
      assert.equal(db.state.calls.some(call => call.statement.startsWith('DELETE FROM archivos_metadatos')), false);
      await fs.access(existingPath);
    }));
  } finally {
    await removeIfPresent(existingName);
  }
});

test('PUT y DELETE requieren sesión antes de tocar PostgreSQL', async () => {
  const db = makeManagementDb();
  await withManagementContext({ db }, () => withServer(async url => {
    const update = await fetch(`${url}/api/v1/reportes/91`, {
      method: 'PUT',
      body: makeReportForm(),
    });
    const remove = await fetch(`${url}/api/v1/reportes/91`, { method: 'DELETE' });
    assert.equal(update.status, 401);
    assert.equal(remove.status, 401);
    assert.equal(db.state.calls.length, 0);
  }));
});

test('PUT /api/v1/reportes/:id deniega a otro usuario y limpia la imagen recibida', async () => {
  const uploadId = '23000000-0000-4000-8000-000000000001';
  const uploadedName = `${uploadId}.png`;
  const oldName = '23000000-0000-4000-8000-000000000002.png';
  const oldPath = await writeExistingImage(oldName);
  const db = makeManagementDb({ ownerId: '8', metadata: [makeMetadata(oldName)] });
  try {
    await withFixedUuid(uploadId, () => withManagementContext({ db }, () => withServer(async url => {
      const response = await fetch(`${url}/api/v1/reportes/91`, {
        method: 'PUT',
        headers: { Cookie: sessionCookie('7') },
        body: makeReportForm({ image: true }),
      });
      const body = await response.json();
      const deleteResponse = await fetch(`${url}/api/v1/reportes/91`, {
        method: 'DELETE',
        headers: { Cookie: sessionCookie('7') },
      });

      assert.equal(response.status, 403);
      assert.equal(body.error.code, 'FORBIDDEN');
      assert.equal(deleteResponse.status, 403);
      assert.equal(db.state.calls.some(call => call.statement.startsWith('UPDATE reportes_objetos')), false);
      assert.equal(db.state.calls.some(call => call.statement.startsWith('DELETE FROM reportes_objetos')), false);
      await assert.rejects(fs.access(resolveUploadPath(uploadedName)), { code: 'ENOENT' });
      await fs.access(oldPath);
    })));
  } finally {
    await removeIfPresent(uploadedName);
    await removeIfPresent(oldName);
  }
});

test('DELETE /api/v1/reportes/:id responde 204 y elimina metadata y archivo del autor', async () => {
  const oldName = '24000000-0000-4000-8000-000000000001.png';
  const oldPath = await writeExistingImage(oldName);
  const db = makeManagementDb({ metadata: [makeMetadata(oldName)] });
  try {
    await withManagementContext({ db }, () => withServer(async url => {
      const response = await fetch(`${url}/api/v1/reportes/91`, {
        method: 'DELETE',
        headers: { Cookie: sessionCookie() },
      });

      assert.equal(response.status, 204);
      assert.equal(await response.text(), '');
      assert.equal(db.state.exists, false);
      assert.deepEqual(db.state.metadata, []);
      assert.deepEqual(db.state.calls.slice(-2).map(call => call.statement), [
        'DELETE FROM reportes_objetos WHERE id = $1 RETURNING id',
        'COMMIT',
      ]);
      await assert.rejects(fs.access(oldPath), { code: 'ENOENT' });
    }));
  } finally {
    await removeIfPresent(oldName);
  }
});

test('administrador puede eliminar reportes de otro autor', async () => {
  const db = makeManagementDb({ ownerId: '8' });
  await withManagementContext({ db, role: 'Administrador' }, () => withServer(async url => {
    const response = await fetch(`${url}/api/v1/reportes/91`, {
      method: 'DELETE',
      headers: { Cookie: sessionCookie('7') },
    });
    assert.equal(response.status, 204);
    assert.equal(db.state.exists, false);
  }));
});

test('DELETE /api/v1/reportes/:id restaura el archivo si la transacción falla', async () => {
  const oldName = '25000000-0000-4000-8000-000000000001.png';
  const oldPath = await writeExistingImage(oldName);
  const db = makeManagementDb({ metadata: [makeMetadata(oldName)], failDelete: true });
  try {
    await withManagementContext({ db }, () => withServer(async url => {
      const response = await fetch(`${url}/api/v1/reportes/91`, {
        method: 'DELETE',
        headers: { Cookie: sessionCookie() },
      });
      const body = await response.json();

      assert.equal(response.status, 409);
      assert.equal(body.error.code, 'REPORT_HAS_DEPENDENCIES');
      assert.equal(db.state.exists, true);
      assert.ok(db.state.calls.some(call => call.statement === 'ROLLBACK'));
      await fs.access(oldPath);
      const remaining = await fs.readdir(UPLOADS_DIR);
      assert.equal(remaining.some(name => name.startsWith('.deleting-')), false);
    }));
  } finally {
    await removeIfPresent(oldName);
  }
});

test('PUT y DELETE devuelven 404 cuando el reporte no existe', async () => {
  const db = makeManagementDb({ exists: false });
  await withManagementContext({ db }, () => withServer(async url => {
    const update = await fetch(`${url}/api/v1/reportes/999`, {
      method: 'PUT',
      headers: { Cookie: sessionCookie() },
      body: makeReportForm(),
    });
    const deleteResponse = await fetch(`${url}/api/v1/reportes/999`, {
      method: 'DELETE',
      headers: { Cookie: sessionCookie() },
    });
    assert.equal(update.status, 404);
    assert.equal(deleteResponse.status, 404);
  }));
});
