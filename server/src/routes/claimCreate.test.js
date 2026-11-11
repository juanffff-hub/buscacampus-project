const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const jwt = require('jsonwebtoken');
const app = require('../app');
const pool = require('../config/database');
const userRepository = require('../repositories/userRepository');
const {
  PRIVATE_UPLOADS_DIR,
  deletePrivateEvidenceFile,
  resolvePrivateEvidencePath,
} = require('../middleware/claimEvidenceUpload');

const SECRET = 'claims-create-test-secret-with-at-least-thirty-two-bytes';
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

function sessionCookie(id = '8') {
  const token = jwt.sign({ sub: id }, SECRET, { expiresIn: '1m' });
  return `buscacampus_session=${token}`;
}

function claimForm({ message = 'La funda tiene una marca personal.', image = true } = {}) {
  const form = new FormData();
  form.append('mensajePrueba', message);
  if (image) form.append('archivo', new Blob([PNG_BYTES], { type: 'image/png' }), 'C:\\fakepath\\marca.png');
  return form;
}

function makeClaimDb({ report = {}, duplicate = false, failEvidence = false, missingReport = false } = {}) {
  const state = {
    report: missingReport ? null : {
      id: '91',
      ownerId: '7',
      type: 'Encontrado',
      status: 'Publicado',
      ...report,
    },
    claim: null,
    evidence: null,
    duplicate,
    failEvidence,
    calls: [],
    released: false,
  };

  return {
    state,
    connect: async () => {
      let snapshot;
      return {
        query: async (sql, values = []) => {
          const statement = sql.trim().replace(/\s+/g, ' ');
          state.calls.push({ statement, values });
          if (statement === 'BEGIN') {
            snapshot = { claim: state.claim, evidence: state.evidence, status: state.report?.status };
            return { rows: [] };
          }
          if (statement.includes('FROM reportes_objetos') && statement.endsWith('FOR UPDATE')) {
            return { rows: state.report ? [{
              id: state.report.id,
              ownerId: state.report.ownerId,
              type: state.report.type,
              status: state.report.status,
            }] : [] };
          }
          if (statement.startsWith('INSERT INTO reclamaciones ')) {
            if (state.duplicate) {
              const error = new Error('duplicate unique key');
              error.code = '23505';
              throw error;
            }
            state.claim = {
              id: '301',
              reclamanteId: values[0],
              reporteId: values[1],
              mensajePrueba: values[2],
              fechaReclamacion: '2026-11-10T12:00:00.000Z',
              estado: 'Pendiente',
            };
            return { rows: [state.claim] };
          }
          if (statement.startsWith('INSERT INTO reclamaciones_archivos_metadatos')) {
            if (state.failEvidence) {
              const error = new Error('internal database failure');
              error.code = 'XX000';
              throw error;
            }
            state.evidence = {
              id: '401',
              reclamacionId: values[0],
              usuarioAutorId: values[1],
              nombreOriginal: values[2],
              nombreFisico: values[3],
              mimeType: values[4],
              extension: values[5],
              pesoBytes: String(values[6]),
              ubicacionInterna: values[7],
              fechaSubida: '2026-11-10T12:00:01.000Z',
            };
            return { rows: [{
              id: state.evidence.id,
              nombreOriginal: state.evidence.nombreOriginal,
              mimeType: state.evidence.mimeType,
              extension: state.evidence.extension,
              pesoBytes: state.evidence.pesoBytes,
              fechaSubida: state.evidence.fechaSubida,
            }] };
          }
          if (statement.startsWith('UPDATE reportes_objetos')) {
            state.report.status = 'En reclamación';
            return { rows: [] };
          }
          if (statement === 'COMMIT') return { rows: [] };
          if (statement === 'ROLLBACK') {
            state.claim = snapshot?.claim || null;
            state.evidence = snapshot?.evidence || null;
            if (snapshot && state.report) state.report.status = snapshot.status;
            return { rows: [] };
          }
          throw new Error(`Unexpected claim transaction query: ${statement}`);
        },
        release: () => { state.released = true; },
      };
    },
  };
}

async function withClaimContext({ db, userId = '8' }, run) {
  const originalConnect = pool.connect;
  const originalFindById = userRepository.findById;
  const originalSecret = process.env.JWT_SECRET;
  pool.connect = db.connect;
  userRepository.findById = async id => ({
    id,
    nombre_completo: 'Diego Pérez',
    correo_electronico: 'diego@uao.edu.co',
    rol: 'Usuario',
    estado: 'Activo',
    fecha_registro: '2026-11-10T11:00:00.000Z',
  });
  process.env.JWT_SECRET = SECRET;
  try {
    return await run(userId);
  } finally {
    pool.connect = originalConnect;
    userRepository.findById = originalFindById;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
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

test('POST /api/v1/reportes/:id/reclamaciones guarda reclamación y evidencia con estado transaccional', async () => {
  const db = makeClaimDb();
  const uploadId = 'ab000000-0000-4000-8000-000000000001';
  const filename = `${uploadId}.png`;
  await assert.rejects(fs.access(resolvePrivateEvidencePath(filename)), { code: 'ENOENT' });
  try {
    await withFixedUuid(uploadId, () => withClaimContext({ db }, () => withServer(async url => {
      const response = await fetch(`${url}/api/v1/reportes/91/reclamaciones`, {
        method: 'POST',
        headers: { Cookie: sessionCookie() },
        body: claimForm(),
      });
      const body = await response.json();

      assert.equal(response.status, 201, JSON.stringify(body));
      assert.equal(body.success, true);
      assert.equal(body.data.reclamacion.id, '301');
      assert.equal(body.data.reclamacion.estado, 'Pendiente');
      assert.equal(body.data.reclamacion.evidencia.nombreOriginal, 'marca.png');
      assert.equal(body.data.reclamacion.evidencia.mimeType, 'image/png');
      assert.equal(body.data.reclamacion.evidencia.pesoBytes, PNG_BYTES.length);
      assert.doesNotMatch(JSON.stringify(body), /nombreFisico|ubicacionInterna|private_uploads|[A-Z]:\\/i);
      assert.equal(db.state.report.status, 'En reclamación');
      assert.equal(db.state.claim.reclamanteId, '8');
      assert.equal(db.state.evidence.nombreFisico, filename);
      assert.equal(db.state.evidence.usuarioAutorId, '8');
      assert.equal(db.state.evidence.ubicacionInterna, `private_uploads/${filename}`);
      assert.deepEqual(db.state.calls.map(call => call.statement.split(' ')[0]), [
        'BEGIN', 'SELECT', 'INSERT', 'INSERT', 'UPDATE', 'COMMIT',
      ]);
      assert.match(db.state.calls[1].statement, /FOR UPDATE$/);
      assert.equal(db.state.released, true);
      assert.deepEqual(await fs.readFile(resolvePrivateEvidencePath(filename)), PNG_BYTES);
    })));
  } finally {
    await deletePrivateEvidenceFile(filename);
  }
});

test('POST de reclamación requiere sesión y una imagen de evidencia', async () => {
  const db = makeClaimDb();
  await withClaimContext({ db }, () => withServer(async url => {
    const unauthorized = await fetch(`${url}/api/v1/reportes/91/reclamaciones`, {
      method: 'POST',
      body: claimForm(),
    });
    assert.equal(unauthorized.status, 401);
    assert.equal(db.state.calls.length, 0);

    const missing = await fetch(`${url}/api/v1/reportes/91/reclamaciones`, {
      method: 'POST',
      headers: { Cookie: sessionCookie() },
      body: claimForm({ image: false }),
    });
    const body = await missing.json();
    assert.equal(missing.status, 400);
    assert.equal(body.error.code, 'EVIDENCE_REQUIRED');
    assert.equal(db.state.calls.length, 0);
  }));
});

test('rechaza mensaje inválido antes de PostgreSQL y limpia la imagen recibida', async () => {
  const db = makeClaimDb();
  const uploadId = 'ae000000-0000-4000-8000-000000000002';
  const filename = `${uploadId}.png`;
  await assert.rejects(fs.access(resolvePrivateEvidencePath(filename)), { code: 'ENOENT' });
  try {
    await withFixedUuid(uploadId, () => withClaimContext({ db }, () => withServer(async url => {
      const response = await fetch(`${url}/api/v1/reportes/91/reclamaciones`, {
        method: 'POST',
        headers: { Cookie: sessionCookie() },
        body: claimForm({ message: 'corto' }),
      });
      const body = await response.json();
      assert.equal(response.status, 400);
      assert.equal(body.error.code, 'VALIDATION_ERROR');
      assert.equal(db.state.calls.length, 0);
      await assert.rejects(fs.access(resolvePrivateEvidencePath(filename)), { code: 'ENOENT' });
    })));
  } finally {
    await deletePrivateEvidenceFile(filename);
  }
});

test('reporte inexistente responde 404 y elimina la evidencia temporal', async () => {
  const db = makeClaimDb({ missingReport: true });
  const uploadId = 'ae000000-0000-4000-8000-000000000003';
  const filename = `${uploadId}.png`;
  await assert.rejects(fs.access(resolvePrivateEvidencePath(filename)), { code: 'ENOENT' });
  try {
    await withFixedUuid(uploadId, () => withClaimContext({ db }, () => withServer(async url => {
      const response = await fetch(`${url}/api/v1/reportes/999/reclamaciones`, {
        method: 'POST',
        headers: { Cookie: sessionCookie() },
        body: claimForm(),
      });
      assert.equal(response.status, 404);
      assert.equal((await response.json()).error.code, 'REPORT_NOT_FOUND');
      assert.equal(db.state.claim, null);
      assert.equal(db.state.evidence, null);
    })));
    await assert.rejects(fs.access(resolvePrivateEvidencePath(filename)), { code: 'ENOENT' });
  } finally {
    await deletePrivateEvidenceFile(filename);
  }
});

test('acepta otra persona cuando el reporte ya tiene reclamaciones pendientes', async () => {
  const db = makeClaimDb({ report: { status: 'En reclamación' } });
  const uploadId = 'ae000000-0000-4000-8000-000000000004';
  const filename = `${uploadId}.png`;
  try {
    await withFixedUuid(uploadId, () => withClaimContext({ db, userId: '10' }, () => withServer(async url => {
      const response = await fetch(`${url}/api/v1/reportes/91/reclamaciones`, {
        method: 'POST',
        headers: { Cookie: sessionCookie('10') },
        body: claimForm(),
      });
      assert.equal(response.status, 201);
      assert.equal(db.state.report.status, 'En reclamación');
      assert.equal(db.state.claim.reclamanteId, '10');
    })));
  } finally {
    await deletePrivateEvidenceFile(filename);
  }
});

test('rechaza autor, reportes Perdido y Devuelto; revierte y limpia evidencia ante error SQL', async () => {
  const cases = [
    { name: 'owner', report: { ownerId: '8' }, code: 'REPORT_OWNER_CANNOT_CLAIM' },
    { name: 'lost', report: { type: 'Perdido' }, code: 'REPORT_NOT_FOUND_TYPE' },
    { name: 'returned', report: { status: 'Devuelto' }, code: 'REPORT_ALREADY_RETURNED' },
    { name: 'sql', failEvidence: true, code: 'INTERNAL_SERVER_ERROR', status: 500 },
  ];

  for (let index = 0; index < cases.length; index += 1) {
    const scenario = cases[index];
    const db = makeClaimDb(scenario);
    const uploadId = `ac000000-0000-4000-8000-00000000000${index + 1}`;
    const filename = `${uploadId}.png`;
    await assert.rejects(fs.access(resolvePrivateEvidencePath(filename)), { code: 'ENOENT' });
    try {
      await withFixedUuid(uploadId, () => withClaimContext({ db }, () => withServer(async url => {
        const response = await fetch(`${url}/api/v1/reportes/91/reclamaciones`, {
          method: 'POST',
          headers: { Cookie: sessionCookie() },
          body: claimForm(),
        });
        const body = await response.json();
        assert.equal(response.status, scenario.status || 409, scenario.name);
        assert.equal(body.error.code, scenario.code, scenario.name);
        assert.equal(db.state.claim, null, scenario.name);
        assert.equal(db.state.evidence, null, scenario.name);
        assert.equal(db.state.report.status, scenario.report?.status || 'Publicado', scenario.name);
        assert.ok(db.state.calls.some(call => call.statement === 'ROLLBACK'), scenario.name);
        assert.doesNotMatch(JSON.stringify(body), /private_uploads|database failure|[A-Z]:\\/i);
      })));
      await assert.rejects(fs.access(resolvePrivateEvidencePath(filename)), { code: 'ENOENT' });
    } finally {
      await deletePrivateEvidenceFile(filename);
    }
  }
});

test('la restricción única de usuario y reporte responde 409 y limpia el archivo', async () => {
  const db = makeClaimDb({ duplicate: true });
  const uploadId = 'ad000000-0000-4000-8000-000000000001';
  const filename = `${uploadId}.png`;
  await assert.rejects(fs.access(resolvePrivateEvidencePath(filename)), { code: 'ENOENT' });
  try {
    await withFixedUuid(uploadId, () => withClaimContext({ db }, () => withServer(async url => {
      const response = await fetch(`${url}/api/v1/reportes/91/reclamaciones`, {
        method: 'POST',
        headers: { Cookie: sessionCookie() },
        body: claimForm(),
      });
      const body = await response.json();
      assert.equal(response.status, 409);
      assert.equal(body.error.code, 'DUPLICATE_CLAIM');
      assert.equal(db.state.report.status, 'Publicado');
      assert.ok(db.state.calls.some(call => call.statement === 'ROLLBACK'));
    })));
    await assert.rejects(fs.access(resolvePrivateEvidencePath(filename)), { code: 'ENOENT' });
  } finally {
    await deletePrivateEvidenceFile(filename);
  }
});
