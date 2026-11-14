const fs = require('node:fs/promises');
const path = require('node:path');
const { PHYSICAL_NAME_PATTERN } = require('./storage');

const STAGED_NAME_PATTERN = /^\.deleting-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function inspectDirectory(directory, expectedNames) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    entries = null;
  }

  const storedFiles = new Set();
  let stagedFiles = 0;
  let orphanFiles = 0;
  let unexpectedFiles = 0;

  for (const entry of entries || []) {
    if (!entry.isFile()) {
      unexpectedFiles += 1;
      continue;
    }
    if (entry.name === '.gitkeep') continue;
    if (STAGED_NAME_PATTERN.test(entry.name)) {
      stagedFiles += 1;
      continue;
    }
    if (!PHYSICAL_NAME_PATTERN.test(entry.name)) {
      unexpectedFiles += 1;
      continue;
    }
    storedFiles.add(entry.name);
    if (!expectedNames.has(entry.name)) orphanFiles += 1;
  }

  let missingFiles = 0;
  for (const name of expectedNames) {
    if (!storedFiles.has(name)) missingFiles += 1;
  }

  return {
    directoryPresent: entries !== null,
    metadataFiles: expectedNames.size,
    missingFiles,
    orphanFiles,
    stagedFiles,
    unexpectedFiles,
  };
}

async function diagnoseFileStorage({ query, publicDirectory, privateDirectory }) {
  const result = await query(
    `SELECT 'report'::text AS storage, nombre_fisico AS filename
     FROM archivos_metadatos
     UNION ALL
     SELECT 'claimEvidence'::text AS storage, nombre_fisico AS filename
     FROM reclamaciones_archivos_metadatos`,
  );

  const expected = { report: new Set(), claimEvidence: new Set() };
  let invalidMetadataNames = 0;
  for (const row of result.rows) {
    if (!expected[row.storage] || !PHYSICAL_NAME_PATTERN.test(row.filename || '')) {
      invalidMetadataNames += 1;
      continue;
    }
    expected[row.storage].add(row.filename);
  }

  const [reportImages, claimEvidence] = await Promise.all([
    inspectDirectory(path.resolve(publicDirectory), expected.report),
    inspectDirectory(path.resolve(privateDirectory), expected.claimEvidence),
  ]);
  const discrepancyCount = invalidMetadataNames + [reportImages, claimEvidence]
    .reduce((total, item) => total + item.missingFiles + item.orphanFiles + item.stagedFiles + item.unexpectedFiles, 0);

  return {
    status: discrepancyCount === 0 ? 'ok' : 'mismatch',
    invalidMetadataNames,
    reportImages,
    claimEvidence,
    readOnly: true,
  };
}

module.exports = { diagnoseFileStorage };
