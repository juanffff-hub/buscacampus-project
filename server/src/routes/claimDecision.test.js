const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('../app');
const pool = require('../config/database');
const userRepository = require('../repositories/userRepository');

const SECRET = 'claims-decision-test-secret-with-at-least-thirty-two-bytes';

async function withServer(run) {
  const server = app.listen(0);
  try {
    await new Promise(resolve => server.once('listening', resolve));
    return await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

function sessionCookie(id) {
  const token = jwt.sign({ sub: String(id) }, SECRET, { expiresIn: '1m' });
  return `buscacampus_session=${token}`;
}

function makeDecisionDb({ claims = [
  { id: '301', status: 'Pendiente' },
  { id: '302', status: 'Pendiente' },
] } = {}) {
  const state = {
    report: { id: '91', ownerId: '7', title: 'Termo verde', status: 'En reclamación' },
    claims: claims.map(claim => ({ reportId: '91', claimantId: claim.id === '301' ? '8' : '10', ...claim })),
    calls: [],
    transactions: 0,
    commits: 0,
  };
  let lockQueue = Promise.resolve();

  return {
    state,
    connect: async () => {
      let releaseLock;
      let snapshot;
      let hasLock = false;

      function snapshotBeforeMutation() {
        if (!snapshot) {
          snapshot = {
            reportStatus: state.report.status,
            claims: state.claims.map(claim => ({ ...claim })),
          };
        }
      }

      function releaseReportLock() {
        if (hasLock) {
          hasLock = false;
          releaseLock?.();
        }
      }

      return {
        query: async (sql, values = []) => {
          const statement = sql.trim().replace(/\s+/g, ' ');
          state.calls.push({ statement, values });

          if (statement === 'BEGIN') {
            state.transactions += 1;
            return { rows: [] };
          }
          if (statement.startsWith('SELECT reporte_id::text AS "reporteId" FROM reclamaciones')) {
            const claim = state.claims.find(item => item.id === values[0]);
            return { rows: claim ? [{ reporteId: claim.reportId }] : [] };
          }
          if (statement.startsWith('SELECT id::text AS id, usuario_creador_id::text AS "ownerId"') && statement.endsWith('FOR UPDATE')) {
            const previous = lockQueue;
            lockQueue = new Promise(resolve => { releaseLock = resolve; });
            await previous;
            hasLock = true;
            return { rows: state.report.id === values[0] ? [{
              id: state.report.id,
              ownerId: state.report.ownerId,
              status: state.report.status,
            }] : [] };
          }
          if (statement.startsWith('SELECT estado FROM reclamaciones WHERE id = $1 FOR UPDATE')) {
            const claim = state.claims.find(item => item.id === values[0]);
            return { rows: claim ? [{ estado: claim.status }] : [] };
          }
          if (statement.startsWith('UPDATE reclamaciones SET estado = $1')) {
            snapshotBeforeMutation();
            const claim = state.claims.find(item => item.id === values[1]);
            if (claim?.status === 'Pendiente') claim.status = values[0];
            return { rows: [] };
          }
          if (statement.startsWith("UPDATE reclamaciones SET estado = 'Rechazada'")) {
            snapshotBeforeMutation();
            for (const claim of state.claims) {
              if (claim.reportId === values[0] && claim.id !== values[1] && claim.status === 'Pendiente') {
                claim.status = 'Rechazada';
              }
            }
            return { rows: [] };
          }
          if (statement.startsWith('UPDATE reportes_objetos SET estado =')) {
            snapshotBeforeMutation();
            state.report.status = statement.includes("'Devuelto'") ? 'Devuelto' : 'Publicado';
            return { rows: [] };
          }
          if (statement.startsWith('SELECT COUNT(*) FILTER')) {
            const claimsForReport = state.claims.filter(claim => claim.reportId === values[0]);
            return { rows: [{
              pendientes: String(claimsForReport.filter(claim => claim.status === 'Pendiente').length),
              aprobadas: String(claimsForReport.filter(claim => claim.status === 'Aprobada').length),
            }] };
          }
          if (statement.startsWith('SELECT c.id::text AS id')) {
            const claim = state.claims.find(item => item.id === values[0]);
            if (!claim) return { rows: [] };
            return { rows: [{
              id: claim.id,
              reporteId: claim.reportId,
              reclamanteId: claim.claimantId,
              reclamanteNombre: 'Persona reclamante',
              mensajePrueba: 'Tiene una marca personal visible.',
              fechaReclamacion: '2026-11-10T12:00:00.000Z',
              estado: claim.status,
              reporteTitulo: state.report.title,
              reporteTipo: 'Encontrado',
              reporteEstado: state.report.status,
              autorReporteId: state.report.ownerId,
              autorReporteNombre: 'Autora del reporte',
              evidenciaId: `4${claim.id}`,
              evidenciaNombreOriginal: 'marca.png',
              evidenciaMimeType: 'image/png',
              evidenciaExtension: '.png',
              evidenciaPesoBytes: '9',
              evidenciaFechaSubida: '2026-11-10T12:00:01.000Z',
              evidenciaNombreFisico: 'af000000-0000-4000-8000-000000000001.png',
            }] };
          }
          if (statement === 'COMMIT') {
            state.commits += 1;
            releaseReportLock();
            return { rows: [] };
          }
          if (statement === 'ROLLBACK') {
            if (snapshot) {
              state.report.status = snapshot.reportStatus;
              state.claims = snapshot.claims;
            }
            releaseReportLock();
            return { rows: [] };
          }
          throw new Error(`Unexpected decision query: ${statement}`);
        },
        release: releaseReportLock,
      };
    },
  };
}

async function withDecisionContext({ db }, run) {
  const originalConnect = pool.connect;
  const originalFindById = userRepository.findById;
  const originalSecret = process.env.JWT_SECRET;
  pool.connect = db.connect;
  userRepository.findById = async id => ({
    id,
    nombre_completo: 'Usuario de prueba',
    correo_electronico: `${id}@uao.edu.co`,
    rol: String(id) === '9' ? 'Administrador' : 'Usuario',
    estado: 'Activo',
    fecha_registro: '2026-11-10T11:00:00.000Z',
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

async function decide(url, claimId, status, userId = '7') {
  return fetch(`${url}/api/v1/reclamaciones/${claimId}/estado`, {
    method: 'PATCH',
    headers: {
      Cookie: sessionCookie(userId),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ estado: status }),
  });
}

test('aprobar bloquea el reporte, rechaza las demás pendientes y marca Devuelto', async () => {
  const db = makeDecisionDb();
  await withDecisionContext({ db }, () => withServer(async url => {
    const response = await decide(url, '301', 'Aprobada');
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.reclamacion.estado, 'Aprobada');
    assert.deepEqual(db.state.claims.map(claim => claim.status), ['Aprobada', 'Rechazada']);
    assert.equal(db.state.report.status, 'Devuelto');
    assert.equal(db.state.commits, 1);
    assert.equal(db.state.calls.some(call => call.statement.endsWith('FOR UPDATE')), true);
  }));
});

test('rechazar conserva En reclamación mientras haya pendientes y vuelve a Publicado al terminar', async () => {
  const db = makeDecisionDb();
  await withDecisionContext({ db }, () => withServer(async url => {
    const first = await decide(url, '301', 'Rechazada');
    assert.equal(first.status, 200);
    assert.equal(db.state.report.status, 'En reclamación');
    assert.deepEqual(db.state.claims.map(claim => claim.status), ['Rechazada', 'Pendiente']);

    const last = await decide(url, '302', 'Rechazada');
    assert.equal(last.status, 200);
    assert.equal(db.state.report.status, 'Publicado');
    assert.deepEqual(db.state.claims.map(claim => claim.status), ['Rechazada', 'Rechazada']);
  }));
});

test('solo autor o administrador decide y una transición repetida devuelve 409', async () => {
  const db = makeDecisionDb({ claims: [{ id: '301', status: 'Aprobada' }] });
  await withDecisionContext({ db }, () => withServer(async url => {
    const unauthorized = await fetch(`${url}/api/v1/reclamaciones/301/estado`, { method: 'PATCH' });
    assert.equal(unauthorized.status, 401);

    const forbidden = await decide(url, '301', 'Rechazada', '8');
    assert.equal(forbidden.status, 403);
    assert.equal((await forbidden.json()).error.code, 'FORBIDDEN');

    const decided = await decide(url, '301', 'Rechazada');
    assert.equal(decided.status, 409);
    assert.equal((await decided.json()).error.code, 'CLAIM_ALREADY_DECIDED');

    const invalid = await fetch(`${url}/api/v1/reclamaciones/301/estado`, {
      method: 'PATCH',
      headers: { Cookie: sessionCookie('7'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'Pendiente' }),
    });
    assert.equal(invalid.status, 400);
    assert.deepEqual(db.state.claims.map(claim => claim.status), ['Aprobada']);
  }));
});

test('dos decisiones simultáneas sobre reclamaciones del reporte no pueden aprobar ambas', async () => {
  const db = makeDecisionDb();
  await withDecisionContext({ db }, () => withServer(async url => {
    const responses = await Promise.all([
      decide(url, '301', 'Aprobada'),
      decide(url, '302', 'Aprobada'),
    ]);
    const statuses = responses.map(response => response.status).sort();
    assert.deepEqual(statuses, [200, 409]);
    assert.equal(db.state.claims.filter(claim => claim.status === 'Aprobada').length, 1);
    assert.equal(db.state.claims.filter(claim => claim.status === 'Rechazada').length, 1);
    assert.equal(db.state.report.status, 'Devuelto');
    assert.equal(db.state.commits, 1);
  }));
});
