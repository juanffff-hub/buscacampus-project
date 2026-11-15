const fs = require('node:fs/promises');
const path = require('node:path');
const { Client } = require('pg');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const SQL_DIR = path.resolve(__dirname, '../sql');

async function initializeDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Define DATABASE_URL antes de inicializar PostgreSQL.');
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    options: process.env.PGOPTIONS,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  try {
    const migrationsDirectory = path.join(SQL_DIR, 'migrations');
    const migrations = (await fs.readdir(migrationsDirectory))
      .filter(file => file.endsWith('.sql'))
      .sort();
    const scripts = [
      ['schema.sql', path.join(SQL_DIR, 'schema.sql')],
      ...migrations.map(file => [file, path.join(migrationsDirectory, file)]),
      ['seed.sql', path.join(SQL_DIR, 'seed.sql')],
    ];

    for (const [name, filename] of scripts) {
      await client.query(await fs.readFile(filename, 'utf8'));
      console.log(`Aplicado: ${name}`);
    }
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  initializeDatabase().catch(() => {
    console.error('No se pudo inicializar la base. Verifica DATABASE_URL y PostgreSQL.');
    process.exitCode = 1;
  });
}

module.exports = { initializeDatabase };
