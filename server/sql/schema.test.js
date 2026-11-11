const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
const migration = fs.readFileSync(
  path.join(__dirname, 'migrations', '20261110_001_reclamacion_evidencia.sql'),
  'utf8',
);

test('el esquema nuevo crea metadatos privados vinculados a reclamación y usuario', () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS reclamaciones_archivos_metadatos/i);
  assert.match(schema, /reclamacion_id BIGINT NOT NULL UNIQUE REFERENCES reclamaciones\(id\)/i);
  assert.match(schema, /usuario_autor_id BIGINT NOT NULL REFERENCES usuarios\(id\)/i);
  assert.match(schema, /nombre_original[\s\S]*nombre_fisico[\s\S]*mime_type[\s\S]*extension[\s\S]*peso_bytes[\s\S]*ubicacion_interna[\s\S]*fecha_subida/i);
  assert.match(schema, /peso_bytes BIGINT NOT NULL CHECK \(peso_bytes > 0 AND peso_bytes <= 5242880\)/i);
  assert.match(schema, /idx_reclamaciones_usuario_fecha/i);
  assert.match(schema, /idx_reclamaciones_evidencia_autor/i);
});

test('la migración desde Avance 2 es repetible y conserva integridad del archivo', () => {
  assert.match(migration.trim(), /^BEGIN;[\s\S]*COMMIT;$/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS reclamaciones_archivos_metadatos/i);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS/i);
  assert.match(migration, /reclamacion_id BIGINT NOT NULL UNIQUE REFERENCES reclamaciones\(id\)/i);
  assert.match(migration, /usuario_autor_id BIGINT NOT NULL REFERENCES usuarios\(id\)/i);
  assert.match(migration, /ubicacion_interna = 'private_uploads\/' \|\| nombre_fisico/i);
  assert.doesNotMatch(migration, /\b(DROP|TRUNCATE)\s+(TABLE|INDEX|SCHEMA)\b/i);
});
