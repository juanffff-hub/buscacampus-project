const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const specification = fs.readFileSync(path.join(__dirname, '../../docs/openapi.yaml'), 'utf8');
const claimRoutes = fs.readFileSync(path.join(__dirname, 'routes/claimRoutes.js'), 'utf8');
const reportRoutes = fs.readFileSync(path.join(__dirname, 'routes/reportRoutes.js'), 'utf8');

test('OpenAPI enumera las rutas reales de reclamaciones y sus esquemas principales', () => {
  for (const apiPath of [
    '/reportes/{id}/reclamaciones',
    '/reclamaciones/mias',
    '/reclamaciones/recibidas',
    '/reclamaciones/{id}',
    '/reclamaciones/{id}/estado',
    '/reclamaciones/{id}/evidencia',
  ]) {
    assert.ok(specification.includes(`  ${apiPath}:`), `OpenAPI documenta ${apiPath}`);
  }
  for (const schemaName of [
    'ClaimCreateRequest', 'ClaimDecisionRequest', 'Claim',
    'ClaimResponse', 'ClaimListResponse', 'ClaimEvidenceMetadata',
  ]) {
    assert.match(specification, new RegExp(`^    ${schemaName}:`, 'm'));
  }

  assert.match(reportRoutes, /router\.post\('\/:id\/reclamaciones'/);
  assert.match(claimRoutes, /router\.get\('\/mias'/);
  assert.match(claimRoutes, /router\.get\('\/recibidas'/);
  assert.match(claimRoutes, /router\.patch\('\/:id\/estado'/);
  assert.match(claimRoutes, /router\.get\('\/:id\/evidencia'/);
});

test('OpenAPI refleja las respuestas públicas y los límites implementados', () => {
  const imageSchema = specification.split('    ImageMetadata:')[1].split('    Report:')[0];
  const updateSchema = specification.split('    ReportUpdateRequest:')[1].split('    ClaimEvidenceMetadata:')[0];
  assert.doesNotMatch(imageSchema, /nombreFisico/);
  assert.doesNotMatch(updateSchema, /^\s+estado:/m);
  assert.match(specification, /maximum: 5242880/);
  assert.match(specification, /maximum: 1000000/);
  assert.match(specification, /"413":\s+\$ref: "#\/components\/responses\/PayloadTooLarge"/);
  assert.match(specification, /private, no-store/);
});

test('OpenAPI no repite rutas y mantiene resueltas las referencias a componentes', () => {
  const paths = [...specification.matchAll(/^  (\/[^:\n]+):$/gm)].map(match => match[1]);
  assert.equal(new Set(paths).size, paths.length);

  const references = [...specification.matchAll(/\$ref: "#\/components\/([^/]+)\/([^"]+)"/g)];
  assert.ok(references.length > 0);
  for (const [, section, name] of references) {
    assert.match(specification, new RegExp(`^  ${section}:`, 'm'), `OpenAPI defines component section ${section}`);
    assert.match(specification, new RegExp(`^    ${name}:`, 'm'), `OpenAPI defines component ${name}`);
  }
});
