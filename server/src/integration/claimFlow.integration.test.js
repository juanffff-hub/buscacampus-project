const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fsSync = require('node:fs');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Client } = require('pg');

const testDatabaseUrl = process.env.AVANCE3_TEST_DATABASE_URL;
const schemaSql = fsSync.readFileSync(path.join(__dirname, '../../sql/schema.sql'), 'utf8');
const seedSql = fsSync.readFileSync(path.join(__dirname, '../../sql/seed.sql'), 'utf8');
const evidenceMigration = fsSync.readFileSync(
  path.join(__dirname, '../../sql/migrations/20261110_001_reclamacion_evidencia.sql'),
  'utf8',
);
const indexMigration = fsSync.readFileSync(
  path.join(__dirname, '../../sql/migrations/20261113_001_avance3_query_indexes.sql'),
  'utf8',
);

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x11]);

function jsonRequest(url, endpoint, cookie, body, method = 'GET') {
  return fetch(`${url}${endpoint}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function cookieFrom(response) {
  const cookie = response.headers.get('set-cookie');
  assert.ok(cookie, 'El login devuelve una cookie de sesión.');
  return cookie.split(';', 1)[0];
}

function assertDedicatedTestDatabase(connectionString) {
  const databaseUrl = new URL(connectionString);
  const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ''));
  if (!/(?:_test|-test)$/i.test(databaseName)) {
    throw new Error('La prueba solo puede ejecutarse contra una base dedicada de test.');
  }
  return databaseUrl;
}

function reportForm(categoryId, locationId, title, filename = 'objeto.png') {
  const form = new FormData();
  form.set('titulo', title);
  form.set('descripcion', 'Objeto encontrado para la prueba integral.');
  form.set('categoriaId', categoryId);
  form.set('ubicacionId', locationId);
  form.set('tipoReporte', 'Encontrado');
  form.set('fechaHoraEvento', new Date().toISOString());
  form.set('archivo', new Blob([PNG_BYTES], { type: 'image/png' }), filename);
  return form;
}

function claimForm(filename = 'evidencia.png') {
  const form = new FormData();
  form.set('mensajePrueba', 'Puedo identificar una marca particular del objeto.');
  form.set('archivo', new Blob([PNG_BYTES], { type: 'image/png' }), filename);
  return form;
}

async function registerAndLogin(url, prefix, name, secret) {
  const email = `${prefix}@uao.edu.co`;
  const registered = await jsonRequest(url, '/api/v1/auth/registro', null, {
    nombreCompleto: name,
    correoElectronico: email,
    contrasena: secret,
  }, 'POST');
  assert.equal(registered.status, 201, await registered.text());

  const login = await jsonRequest(url, '/api/v1/auth/login', null, {
    correoElectronico: email,
    contrasena: secret,
  }, 'POST');
  assert.equal(login.status, 200, await login.text());
  return cookieFrom(login);
}

test('el flujo de integración rechaza una base que no está marcada como test', () => {
  assert.throws(
    () => assertDedicatedTestDatabase('postgres://localhost/buscacampus'),
    /base dedicada de test/,
  );
  assert.doesNotThrow(() => assertDedicatedTestDatabase('postgres://localhost/buscacampus_test'));
});

test('PostgreSQL y archivos aislados recorren publicación, reclamación, decisión y consulta', {
  skip: testDatabaseUrl ? false : 'Configura AVANCE3_TEST_DATABASE_URL con una base aislada cuyo nombre termine en _test o -test.',
}, async () => {
  const databaseUrl = assertDedicatedTestDatabase(testDatabaseUrl);

  const schemaName = `avance3_flow_${crypto.randomUUID().replace(/-/g, '')}`;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'buscacampus-flow-'));
  const publicDirectory = path.join(temporaryRoot, 'uploads');
  const privateDirectory = path.join(temporaryRoot, 'private_uploads');
  const previousEnvironment = Object.fromEntries([
    'DATABASE_URL', 'PGOPTIONS', 'BUSCACAMPUS_UPLOADS_DIR',
    'BUSCACAMPUS_PRIVATE_UPLOADS_DIR', 'JWT_SECRET', 'JWT_EXPIRES_IN', 'COOKIE_SECURE',
  ].map(key => [key, process.env[key]]));
  const setupClient = new Client({ connectionString: testDatabaseUrl });
  let pool;
  let server;
  let schemaCreated = false;

  try {
    await setupClient.connect();
    await setupClient.query(`CREATE SCHEMA "${schemaName}"`);
    schemaCreated = true;
    await setupClient.query(`SET search_path TO "${schemaName}"`);
    await setupClient.query(schemaSql);
    await setupClient.query(seedSql);
    await setupClient.query(evidenceMigration);
    await setupClient.query(evidenceMigration);
    await setupClient.query(indexMigration);
    await setupClient.query(indexMigration);

    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.PGOPTIONS = `-c search_path=${schemaName}`;
    process.env.BUSCACAMPUS_UPLOADS_DIR = publicDirectory;
    process.env.BUSCACAMPUS_PRIVATE_UPLOADS_DIR = privateDirectory;
    process.env.JWT_SECRET = `integration-${crypto.randomUUID()}-session-secret`;
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.COOKIE_SECURE = 'false';

    const app = require('../app');
    pool = require('../config/database');
    server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;

    const unique = crypto.randomUUID().replace(/-/g, '');
    const ownerCookie = await registerAndLogin(url, `owner${unique}`, 'Autora de prueba', 'PruebaSegura123');
    const claimantCookie = await registerAndLogin(url, `claimant${unique}`, 'Reclamante de prueba', 'PruebaSegura123');
    const outsiderCookie = await registerAndLogin(url, `outsider${unique}`, 'Tercera persona', 'PruebaSegura123');

    const categories = await (await fetch(`${url}/api/v1/categorias`)).json();
    const locations = await (await fetch(`${url}/api/v1/ubicaciones`)).json();
    const categoryId = categories.data.items[0]?.id;
    const locationId = locations.data.items[0]?.id;
    assert.ok(categoryId);
    assert.ok(locationId);

    const invalidReportForm = reportForm('999999999', locationId, 'Reporte inválido');
    const invalidReport = await fetch(`${url}/api/v1/reportes`, {
      method: 'POST',
      headers: { Cookie: ownerCookie },
      body: invalidReportForm,
    });
    assert.equal(invalidReport.status, 400);
    assert.deepEqual(await fs.readdir(publicDirectory), [], 'El archivo inválido se elimina tras el error SQL.');

    const createReport = await fetch(`${url}/api/v1/reportes`, {
      method: 'POST',
      headers: { Cookie: ownerCookie },
      body: reportForm(categoryId, locationId, 'Objeto de integración'),
    });
    const createdReportBody = await createReport.json();
    assert.equal(createReport.status, 201, JSON.stringify(createdReportBody));
    const reportId = createdReportBody.data.report.id;
    const reportMetadata = await pool.query(
      'SELECT nombre_fisico, mime_type, extension, peso_bytes FROM archivos_metadatos WHERE reporte_id = $1',
      [reportId],
    );
    assert.equal(reportMetadata.rows.length, 1);
    assert.equal(reportMetadata.rows[0].mime_type, 'image/png');
    assert.equal(reportMetadata.rows[0].extension, '.png');
    assert.equal(Number(reportMetadata.rows[0].peso_bytes), PNG_BYTES.length);
    assert.deepEqual(await fs.readFile(path.join(publicDirectory, reportMetadata.rows[0].nombre_fisico)), PNG_BYTES);
    assert.equal((await fetch(`${url}${createdReportBody.data.report.imagen.url}`)).status, 200);

    const claimResponse = await fetch(`${url}/api/v1/reportes/${reportId}/reclamaciones`, {
      method: 'POST',
      headers: { Cookie: claimantCookie },
      body: claimForm(),
    });
    const claimBody = await claimResponse.json();
    assert.equal(claimResponse.status, 201, JSON.stringify(claimBody));
    const claimId = claimBody.data.reclamacion.id;
    const evidenceMetadata = await pool.query(
      `SELECT nombre_fisico, usuario_autor_id::text AS autor, mime_type, extension,
              peso_bytes, ubicacion_interna
       FROM reclamaciones_archivos_metadatos WHERE reclamacion_id = $1`,
      [claimId],
    );
    assert.equal(evidenceMetadata.rows.length, 1);
    assert.equal(evidenceMetadata.rows[0].autor, claimBody.data.reclamacion.reclamante.id);
    assert.equal(evidenceMetadata.rows[0].mime_type, 'image/png');
    assert.equal(evidenceMetadata.rows[0].extension, '.png');
    assert.equal(Number(evidenceMetadata.rows[0].peso_bytes), PNG_BYTES.length);
    assert.match(evidenceMetadata.rows[0].ubicacion_interna, /^private_uploads\//);
    assert.deepEqual(await fs.readFile(path.join(privateDirectory, evidenceMetadata.rows[0].nombre_fisico)), PNG_BYTES);
    assert.equal((await pool.query('SELECT estado FROM reportes_objetos WHERE id = $1', [reportId])).rows[0].estado, 'En reclamación');

    const duplicateClaim = await fetch(`${url}/api/v1/reportes/${reportId}/reclamaciones`, {
      method: 'POST',
      headers: { Cookie: claimantCookie },
      body: claimForm('duplicado.png'),
    });
    assert.equal(duplicateClaim.status, 409);
    assert.equal((await fs.readdir(privateDirectory)).length, 1, 'El archivo provisional duplicado se elimina.');

    const privatePath = `/api/v1/reclamaciones/${claimId}/evidencia`;
    assert.equal((await fetch(`${url}${privatePath}`)).status, 401);
    assert.equal((await fetch(`${url}${privatePath}`, { headers: { Cookie: outsiderCookie } })).status, 403);
    assert.equal((await fetch(`${url}/uploads/${evidenceMetadata.rows[0].nombre_fisico}`)).status, 404);
    assert.equal((await fetch(`${url}${privatePath}`, { headers: { Cookie: ownerCookie } })).status, 200);
    assert.equal((await fetch(`${url}${privatePath}`, { headers: { Cookie: claimantCookie } })).status, 200);

    const received = await jsonRequest(url, '/api/v1/reclamaciones/recibidas?page=1&limit=10', ownerCookie);
    const mine = await jsonRequest(url, '/api/v1/reclamaciones/mias?page=1&limit=10', claimantCookie);
    assert.equal((await received.json()).data.items[0].id, claimId);
    assert.equal((await mine.json()).data.items[0].id, claimId);

    const decision = await jsonRequest(url, `/api/v1/reclamaciones/${claimId}/estado`, ownerCookie, {
      estado: 'Aprobada',
    }, 'PATCH');
    assert.equal(decision.status, 200, await decision.text());
    const publicDetail = await fetch(`${url}/api/v1/reportes/${reportId}`);
    const publicDetailBody = await publicDetail.json();
    assert.equal(publicDetailBody.data.report.estado, 'Devuelto');
    assert.equal(publicDetailBody.data.report.imagen.nombreFisico, undefined);

    const refreshedHistory = await jsonRequest(url, '/api/v1/reclamaciones/mias?page=1&limit=10', claimantCookie);
    const refreshedHistoryBody = await refreshedHistory.json();
    assert.equal(refreshedHistoryBody.data.items[0].estado, 'Aprobada');
    await fs.access(path.join(privateDirectory, evidenceMetadata.rows[0].nombre_fisico));
    assert.equal((await pool.query('SELECT COUNT(*)::int AS total FROM reclamaciones_archivos_metadatos')).rows[0].total, 1);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (pool) await pool.end();
    if (schemaCreated) {
      await setupClient.query('SET search_path TO public');
      await setupClient.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    }
    await setupClient.end().catch(() => {});
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (path.dirname(path.resolve(temporaryRoot)) === path.resolve(os.tmpdir())) {
      await fs.rm(temporaryRoot, { recursive: true, force: true });
    }
  }
});
