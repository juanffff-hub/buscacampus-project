const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const testDatabaseUrl = process.env.AVANCE3_TEST_DATABASE_URL;
const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
const migrationSql = fs.readFileSync(
  path.join(__dirname, 'migrations', '20261110_001_reclamacion_evidencia.sql'),
  'utf8',
);

test('PostgreSQL de prueba aplica Avance 3 en esquema nuevo y migrado desde Avance 2', {
  skip: testDatabaseUrl ? false : 'Configura AVANCE3_TEST_DATABASE_URL con una base aislada cuyo nombre termine en _test o -test.',
}, async () => {
  const databaseUrl = new URL(testDatabaseUrl);
  const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ''));
  assert.match(databaseName, /(?:_test|-test)$/i, 'La prueba solo puede ejecutarse contra una base dedicada de test.');

  const client = new Client({ connectionString: testDatabaseUrl });
  const schemas = [];
  await client.connect();
  try {
    for (const mode of ['fresh', 'upgrade']) {
      const schemaName = `avance3_${mode}_${crypto.randomUUID().replace(/-/g, '')}`;
      schemas.push(schemaName);
      await client.query(`CREATE SCHEMA "${schemaName}"`);
      await client.query(`SET search_path TO "${schemaName}"`);
      await client.query(schemaSql);
      await client.query(seedSql);

      if (mode === 'upgrade') {
        // Simulate the Avance 2 schema in a newly-created, isolated test schema.
        await client.query('DROP TABLE reclamaciones_archivos_metadatos');
        await client.query('DROP INDEX IF EXISTS idx_reclamaciones_usuario_fecha');
      }

      await client.query(migrationSql);
      await client.query(migrationSql);

      const table = await client.query(
        "SELECT to_regclass('reclamaciones_archivos_metadatos') AS name",
      );
      assert.equal(table.rows[0].name, 'reclamaciones_archivos_metadatos');

      const columns = await client.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2`,
        [schemaName, 'reclamaciones_archivos_metadatos'],
      );
      const columnNames = new Set(columns.rows.map(row => row.column_name));
      for (const required of [
        'reclamacion_id',
        'usuario_autor_id',
        'nombre_original',
        'nombre_fisico',
        'mime_type',
        'extension',
        'peso_bytes',
        'ubicacion_interna',
        'fecha_subida',
      ]) {
        assert.equal(columnNames.has(required), true, `${mode} schema contains ${required}`);
      }

      const indexes = await client.query(
        "SELECT to_regclass('idx_reclamaciones_usuario_fecha') AS claim_index",
      );
      assert.equal(indexes.rows[0].claim_index, 'idx_reclamaciones_usuario_fecha');
      await client.query('SET search_path TO public');
    }
  } finally {
    await client.query('SET search_path TO public');
    for (const schemaName of schemas) {
      await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    }
    await client.end();
  }
});
