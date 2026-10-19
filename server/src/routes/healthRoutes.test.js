const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const pool = require('../config/database');

async function withServer(run) {
  const server = app.listen(0);
  try {
    await new Promise(resolve => server.once('listening', resolve));
    return await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('GET /api/v1/health devuelve 200 cuando PostgreSQL responde', async () => {
  const original = pool.query;
  pool.query = async sql => {
    assert.equal(sql, 'SELECT NOW() AS db_time');
    return { rows: [{ db_time: new Date('2026-09-21T12:00:00Z') }] };
  };
  try {
    await withServer(async url => {
      const response = await fetch(`${url}/api/v1/health`);
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data.status, 'OK');
      assert.equal(body.data.database.connected, true);
      assert.equal(body.data.database.db_time, '2026-09-21T12:00:00.000Z');
    });
  } finally {
    pool.query = original;
  }
});

test('GET /api/v1/health devuelve 503 sin filtrar detalles internos cuando falla PostgreSQL', async () => {
  const original = pool.query;
  pool.query = async () => { throw new Error('clave secreta de prueba'); };
  try {
    await withServer(async url => {
      const response = await fetch(`${url}/api/v1/health`);
      const body = await response.json();
      assert.equal(response.status, 503);
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'DATABASE_UNAVAILABLE');
      assert.equal(body.error.message, 'No se pudo conectar a la base de datos.');
      assert.doesNotMatch(JSON.stringify(body), /clave secreta de prueba/);
    });
  } finally {
    pool.query = original;
  }
});

test('las rutas inexistentes usan el contrato de error estandarizado', async () => {
  await withServer(async url => {
    const response = await fetch(`${url}/api/v1/inexistente`);
    const body = await response.json();
    assert.equal(response.status, 404);
    assert.deepEqual(body, {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'La ruta solicitada no existe.',
        details: [],
      },
    });
  });
});

test('CORS permite credenciales desde el origen del cliente configurado', async () => {
  await withServer(async url => {
    const response = await fetch(`${url}/api/v1/inexistente`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    assert.equal(
      response.headers.get('access-control-allow-origin'),
      'http://localhost:5173',
    );
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  });
});
