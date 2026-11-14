const test = require('node:test');
const assert = require('node:assert/strict');
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

const SECRET = 'claims-read-test-secret-with-at-least-thirty-two-bytes';
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x11]);
const EVIDENCE_NAME = 'ae000000-0000-4000-8000-000000000001.png';

const claimRow = {
  id: '301',
  reporteId: '91',
  reclamanteId: '8',
  reclamanteNombre: 'Diego Pérez',
  mensajePrueba: 'La funda tiene una marca personal.',
  fechaReclamacion: '2026-11-10T12:00:00.000Z',
  estado: 'Pendiente',
  reporteTitulo: 'Termo verde',
  reporteTipo: 'Encontrado',
  reporteEstado: 'En reclamación',
  autorReporteId: '7',
  autorReporteNombre: 'Ana Pérez',
  evidenciaId: '401',
  evidenciaNombreOriginal: 'marca.png',
  evidenciaMimeType: 'image/png',
  evidenciaExtension: '.png',
  evidenciaPesoBytes: String(PNG_BYTES.length),
  evidenciaFechaSubida: '2026-11-10T12:00:01.000Z',
  evidenciaNombreFisico: EVIDENCE_NAME,
};

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

async function withQueryContext({ query }, run) {
  const originalQuery = pool.query;
  const originalFindById = userRepository.findById;
  const originalSecret = process.env.JWT_SECRET;
  pool.query = query;
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
    pool.query = originalQuery;
    userRepository.findById = originalFindById;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
}

test('lista paginada por reporte solo para autor y expone datos sin ruta física', async () => {
  const queries = [];
  await withQueryContext({
    query: async (sql, values = []) => {
      const statement = sql.trim().replace(/\s+/g, ' ');
      queries.push({ statement, values });
      if (statement.startsWith('SELECT id::text AS id, usuario_creador_id')) {
        return { rows: [{ id: '91', ownerId: '7' }] };
      }
      if (statement.includes('FROM reclamaciones c') && statement.includes('LIMIT $2 OFFSET $3')) {
        return { rows: [{ ...claimRow, total: '21' }] };
      }
      throw new Error(`Unexpected read query: ${statement}`);
    },
  }, async () => withServer(async url => {
    const response = await fetch(`${url}/api/v1/reportes/91/reclamaciones?page=2&limit=10`, {
      headers: { Cookie: sessionCookie('7') },
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.data.pagination, { page: 2, limit: 10, total: 21, totalPages: 3 });
    assert.equal(body.data.items[0].reclamante.id, '8');
    assert.equal(body.data.items[0].reporte.autor.id, '7');
    assert.equal(body.data.items[0].evidencia.endpoint, '/api/v1/reclamaciones/301/evidencia');
    assert.doesNotMatch(JSON.stringify(body), /nombreFisico|ubicacionInterna|private_uploads|ae000000/);
    assert.deepEqual(queries.at(-1).values, ['91', 10, 10]);
  }));
});

test('mis reclamaciones requiere sesión y valida la paginación antes de consultar', async () => {
  let listQueries = 0;
  await withQueryContext({
    query: async sql => {
      listQueries += 1;
      if (sql.includes('COUNT(*)::text AS total')) return { rows: [{ total: '0' }] };
      if (sql.includes('FROM reclamaciones c')) return { rows: [] };
      throw new Error(`Unexpected read query: ${sql}`);
    },
  }, async () => withServer(async url => {
    const unauthenticated = await fetch(`${url}/api/v1/reclamaciones/mias`);
    assert.equal(unauthenticated.status, 401);
    assert.equal(listQueries, 0);

    const invalid = await fetch(`${url}/api/v1/reclamaciones/mias?page=0`, {
      headers: { Cookie: sessionCookie('8') },
    });
    assert.equal(invalid.status, 400);
    assert.equal(listQueries, 0);

    const response = await fetch(`${url}/api/v1/reclamaciones/mias?page=1&limit=10`, {
      headers: { Cookie: sessionCookie('8') },
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.data.items, []);
    assert.deepEqual(body.data.pagination, { page: 1, limit: 10, total: 0, totalPages: 0 });
    assert.equal(listQueries, 2);
  }));
});

test('GET reclamaciones del reporte devuelve 403 a terceros y 404 si el reporte falta', async () => {
  let countQueries = 0;
  await withQueryContext({
    query: async (sql, values = []) => {
      if (sql.includes('SELECT id::text AS id, usuario_creador_id')) {
        return { rows: values[0] === '91' ? [{ id: '91', ownerId: '7' }] : [] };
      }
      if (sql.includes('COUNT(*)::text AS total')) {
        countQueries += 1;
        return { rows: [{ total: '0' }] };
      }
      if (sql.includes('FROM reclamaciones c')) return { rows: [] };
      throw new Error(`Unexpected report claim query: ${sql}`);
    },
  }, async () => withServer(async url => {
    const forbidden = await fetch(`${url}/api/v1/reportes/91/reclamaciones`, {
      headers: { Cookie: sessionCookie('8') },
    });
    assert.equal(forbidden.status, 403);
    assert.equal(countQueries, 0);

    const missing = await fetch(`${url}/api/v1/reportes/999/reclamaciones`, {
      headers: { Cookie: sessionCookie('7') },
    });
    assert.equal(missing.status, 404);
    assert.equal(countQueries, 0);
  }));
});

test('GET /api/v1/reclamaciones/recibidas filtra por autor y pagina en una consulta', async () => {
  const queries = [];
  await withQueryContext({
    query: async (sql, values = []) => {
      queries.push({ sql: sql.trim().replace(/\s+/g, ' '), values });
      if (sql.includes('FROM reclamaciones c') && sql.includes('LIMIT')) {
        return { rows: [{ ...claimRow, total: '21' }] };
      }
      throw new Error(`Unexpected received claims query: ${sql}`);
    },
  }, async () => withServer(async url => {
    const unauthenticated = await fetch(`${url}/api/v1/reclamaciones/recibidas`);
    assert.equal(unauthenticated.status, 401);
    assert.equal(queries.length, 0);

    const invalid = await fetch(`${url}/api/v1/reclamaciones/recibidas?page=0`, {
      headers: { Cookie: sessionCookie('7') },
    });
    assert.equal(invalid.status, 400);
    assert.equal(queries.length, 0);

    const response = await fetch(`${url}/api/v1/reclamaciones/recibidas?page=2&limit=10`, {
      headers: { Cookie: sessionCookie('7') },
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.data.pagination, { page: 2, limit: 10, total: 21, totalPages: 3 });
    assert.match(queries[0].sql, /r\.usuario_creador_id = \$1/);
    assert.deepEqual(queries[0].values, ['7', 10, 10]);
    assert.equal(queries.length, 1);
  }));
});

test('el autor, el reclamante y el administrador consultan detalle; terceros reciben 403', async () => {
  await withQueryContext({
    query: async (_sql, values) => ({ rows: values[0] === '999' ? [] : [claimRow] }),
  }, async () => withServer(async url => {
    for (const userId of ['8', '7', '9']) {
      const response = await fetch(`${url}/api/v1/reclamaciones/301`, {
        headers: { Cookie: sessionCookie(userId) },
      });
      const body = await response.json();
      assert.equal(response.status, 200, `authorized user ${userId}`);
      assert.equal(body.data.reclamacion.estado, 'Pendiente');
      assert.equal(body.data.reclamacion.evidencia.nombreOriginal, 'marca.png');
      assert.doesNotMatch(JSON.stringify(body), /nombreFisico|ubicacionInterna|private_uploads|ae000000/);
    }

    const forbidden = await fetch(`${url}/api/v1/reclamaciones/301`, {
      headers: { Cookie: sessionCookie('10') },
    });
    assert.equal(forbidden.status, 403);
    assert.equal((await forbidden.json()).error.code, 'FORBIDDEN');

    const missing = await fetch(`${url}/api/v1/reclamaciones/999`, {
      headers: { Cookie: sessionCookie('8') },
    });
    assert.equal(missing.status, 404);
  }));
});

test('la evidencia se entrega autenticada con cabeceras privadas y no se sirve en /uploads', async () => {
  const filePath = resolvePrivateEvidencePath(EVIDENCE_NAME);
  await assert.rejects(fs.access(filePath), { code: 'ENOENT' });
  await fs.mkdir(PRIVATE_UPLOADS_DIR, { recursive: true });
  await fs.writeFile(filePath, PNG_BYTES);
  try {
    await withQueryContext({
      query: async (_sql, values) => ({ rows: values[0] === '999' ? [] : [claimRow] }),
    }, async () => withServer(async url => {
      const unauthenticated = await fetch(`${url}/api/v1/reclamaciones/301/evidencia`);
      assert.equal(unauthenticated.status, 401);

      const forbidden = await fetch(`${url}/api/v1/reclamaciones/301/evidencia`, {
        headers: { Cookie: sessionCookie('10') },
      });
      assert.equal(forbidden.status, 403);

      const response = await fetch(`${url}/api/v1/reclamaciones/301/evidencia`, {
        headers: { Cookie: sessionCookie('8') },
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'image/png');
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.equal(response.headers.get('content-disposition'), 'inline');
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), PNG_BYTES);

      const publicFile = await fetch(`${url}/uploads/${EVIDENCE_NAME}`);
      assert.equal(publicFile.status, 404);
    }));
  } finally {
    await deletePrivateEvidenceFile(EVIDENCE_NAME);
  }
});
