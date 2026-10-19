const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
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

const registrationUrl = '/api/v1/auth/registro';
const registrationInput = {
  nombreCompleto: '  Ana Pérez  ',
  correoElectronico: 'ANA.PEREZ@UAO.EDU.CO',
  contrasena: 'clave-segura-123',
};
const loginUrl = '/api/v1/auth/login';
const meUrl = '/api/v1/auth/me';
const jwtSecret = 'test-only-secret-with-more-than-thirty-two-bytes';

test('POST /api/v1/auth/registro crea el usuario y solo devuelve datos públicos', async () => {
  const original = pool.query;
  let query;
  pool.query = async (sql, values) => {
    query = { sql, values };
    return {
      rows: [{
        id: '42',
        nombre_completo: values[0],
        correo_electronico: values[1],
        rol: 'Usuario',
        estado: 'Activo',
        fecha_registro: '2026-10-19T12:00:00.000Z',
      }],
    };
  };

  try {
    await withServer(async url => {
      const response = await fetch(`${url}${registrationUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationInput),
      });
      const body = await response.json();

      assert.equal(response.status, 201);
      assert.equal(body.success, true);
      assert.deepEqual(body.data.user, {
        id: '42',
        nombreCompleto: 'Ana Pérez',
        correoElectronico: 'ana.perez@uao.edu.co',
        rol: 'Usuario',
        estado: 'Activo',
        fechaRegistro: '2026-10-19T12:00:00.000Z',
      });
      assert.match(query.sql, /VALUES \(\$1, \$2, \$3\)/);
      assert.deepEqual(query.values.slice(0, 2), [
        'Ana Pérez',
        'ana.perez@uao.edu.co',
      ]);
      assert.notEqual(query.values[2], registrationInput.contrasena);
      assert.equal(await bcrypt.compare(registrationInput.contrasena, query.values[2]), true);
      assert.doesNotMatch(JSON.stringify(body), /contrasena_hash|clave-segura-123/);
    });
  } finally {
    pool.query = original;
  }
});

test('POST /api/v1/auth/registro valida dominio, nombre y contraseña', async () => {
  await withServer(async url => {
    const response = await fetch(`${url}${registrationUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombreCompleto: 'A',
        correoElectronico: 'persona@gmail.com',
        contrasena: 'corta',
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.equal(body.error.message, 'Los datos enviados no son válidos.');
    assert.ok(body.error.details.length >= 3);
  });
});

test('POST /api/v1/auth/registro responde 409 para correo duplicado', async () => {
  const original = pool.query;
  pool.query = async () => {
    const error = new Error('duplicate key value contains private database details');
    error.code = '23505';
    throw error;
  };

  try {
    await withServer(async url => {
      const response = await fetch(`${url}${registrationUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationInput),
      });
      const body = await response.json();

      assert.equal(response.status, 409);
      assert.equal(body.error.code, 'EMAIL_ALREADY_REGISTERED');
      assert.equal(body.error.message, 'Ya existe una cuenta con ese correo institucional.');
      assert.doesNotMatch(JSON.stringify(body), /duplicate key|private database details/);
    });
  } finally {
    pool.query = original;
  }
});

test('POST /api/v1/auth/login crea cookie HttpOnly y GET /auth/me restaura la sesión', async () => {
  const originalQuery = pool.query;
  const originalSecret = process.env.JWT_SECRET;
  const originalExpiresIn = process.env.JWT_EXPIRES_IN;
  const originalCookieSecure = process.env.COOKIE_SECURE;
  const passwordHash = await bcrypt.hash(registrationInput.contrasena, 4);
  const account = {
    id: '42',
    nombre_completo: 'Ana Pérez',
    correo_electronico: 'ana.perez@uao.edu.co',
    contrasena_hash: passwordHash,
    rol: 'Usuario',
    estado: 'Activo',
    fecha_registro: '2026-10-19T12:00:00.000Z',
  };
  process.env.JWT_SECRET = jwtSecret;
  process.env.JWT_EXPIRES_IN = '8h';
  process.env.COOKIE_SECURE = 'false';
  pool.query = async (sql, values) => {
    if (sql.includes('WHERE LOWER(correo_electronico) = LOWER($1)')) {
      assert.deepEqual(values, ['ana.perez@uao.edu.co']);
      return { rows: [account] };
    }
    if (sql.includes('WHERE id = $1')) {
      assert.deepEqual(values, ['42']);
      const { contrasena_hash, ...publicAccount } = account;
      return { rows: [publicAccount] };
    }
    throw new Error('Consulta inesperada en la prueba de sesión.');
  };

  try {
    await withServer(async url => {
      const loginResponse = await fetch(`${url}${loginUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correoElectronico: 'ANA.PEREZ@UAO.EDU.CO',
          contrasena: registrationInput.contrasena,
        }),
      });
      const loginBody = await loginResponse.json();
      const setCookie = loginResponse.headers.get('set-cookie');

      assert.equal(loginResponse.status, 200);
      assert.equal(loginBody.success, true);
      assert.equal(loginBody.data.user.correoElectronico, 'ana.perez@uao.edu.co');
      assert.doesNotMatch(JSON.stringify(loginBody), /eyJ[A-Za-z0-9_-]+\./);
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /SameSite=Lax/i);
      assert.match(setCookie, /Path=\//i);
      assert.doesNotMatch(setCookie, /; Secure/i);

      const cookie = setCookie.split(';')[0];
      const meResponse = await fetch(`${url}${meUrl}`, {
        headers: { Cookie: cookie },
      });
      const meBody = await meResponse.json();

      assert.equal(meResponse.status, 200);
      assert.equal(meBody.success, true);
      assert.deepEqual(meBody.data.user, loginBody.data.user);
      assert.doesNotMatch(JSON.stringify(meBody), /contrasena_hash|eyJ[A-Za-z0-9_-]+\./);
    });
  } finally {
    pool.query = originalQuery;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    if (originalExpiresIn === undefined) delete process.env.JWT_EXPIRES_IN;
    else process.env.JWT_EXPIRES_IN = originalExpiresIn;
    if (originalCookieSecure === undefined) delete process.env.COOKIE_SECURE;
    else process.env.COOKIE_SECURE = originalCookieSecure;
  }
});

test('GET /api/v1/auth/me requiere una sesión válida', async () => {
  await withServer(async url => {
    const response = await fetch(`${url}${meUrl}`);
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.error.code, 'UNAUTHENTICATED');
    assert.doesNotMatch(JSON.stringify(body), /JWT|token/i);
  });
});
