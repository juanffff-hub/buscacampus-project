require('dotenv').config();

const pool = require('../src/config/database');
const { diagnoseFileStorage } = require('../src/files/storageDiagnostics');
const { UPLOADS_DIR } = require('../src/middleware/reportUpload');
const { PRIVATE_UPLOADS_DIR } = require('../src/middleware/claimEvidenceUpload');

async function main() {
  try {
    const diagnosis = await diagnoseFileStorage({
      query: statement => pool.query(statement),
      publicDirectory: UPLOADS_DIR,
      privateDirectory: PRIVATE_UPLOADS_DIR,
    });
    console.log(JSON.stringify(diagnosis, null, 2));
    if (diagnosis.status !== 'ok') process.exitCode = 2;
  } catch {
    console.error('No se pudo completar el diagnóstico. Verifica DATABASE_URL y la conexión con PostgreSQL.');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
