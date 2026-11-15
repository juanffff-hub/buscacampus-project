const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');

const clientDirectory = path.resolve(__dirname, '..');
const repositoryDirectory = path.resolve(clientDirectory, '..');
const serverDirectory = path.join(repositoryDirectory, 'server');
const apiPort = Number(process.env.E2E_API_PORT) || 4000;
const clientPort = Number(process.env.E2E_CLIENT_PORT) || 4173;
const apiOrigin = `http://localhost:${apiPort}`;
const clientOrigin = `http://localhost:${clientPort}`;
const databaseUrl = process.env.AVANCE3_TEST_DATABASE_URL;
const databaseName = databaseUrl
  ? decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''))
  : '';

if (!databaseUrl || !/(?:_test|-test)$/i.test(databaseName)) {
  console.error('E2E requiere AVANCE3_TEST_DATABASE_URL con base terminada en _test o -test.');
  process.exit(1);
}

const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'buscacampus-e2e-'));
const publicDirectory = path.join(storageRoot, 'uploads');
const privateDirectory = path.join(storageRoot, 'private_uploads');
fs.mkdirSync(publicDirectory);
fs.mkdirSync(privateDirectory);

const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  PORT: String(apiPort),
  CLIENT_ORIGIN: clientOrigin,
  JWT_SECRET: process.env.JWT_SECRET || 'e2e-only-secret-with-at-least-32-bytes',
  JWT_EXPIRES_IN: '20m',
  COOKIE_SECURE: 'false',
  BUSCACAMPUS_UPLOADS_DIR: publicDirectory,
  BUSCACAMPUS_PRIVATE_UPLOADS_DIR: privateDirectory,
};
const children = [];
let stopping = false;

function stopChildren() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}

function cleanupStorage() {
  const absoluteRoot = path.resolve(storageRoot);
  if (
    path.dirname(absoluteRoot) === path.resolve(os.tmpdir()) &&
    path.basename(absoluteRoot).startsWith('buscacampus-e2e-')
  ) {
    fs.rmSync(absoluteRoot, { recursive: true, force: true });
  }
}

function shutdown(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  stopChildren();
  cleanupStorage();
  process.exit(exitCode);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('exit', cleanupStorage);

function start(command, args, cwd) {
  const child = spawn(command, args, { cwd, env, stdio: 'inherit' });
  children.push(child);
  child.once('error', error => {
    console.error(`No fue posible iniciar un servicio de E2E: ${error.message}`);
    shutdown(1);
  });
  child.once('exit', (code, signal) => {
    if (!stopping) {
      console.error(`Un servicio de E2E finalizó (${signal || code}).`);
      shutdown(code || 1);
    }
  });
  return child;
}

async function waitFor(url, child, description) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`${description} finalizó antes de estar listo.`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // El servicio aún está iniciando.
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`${description} no respondió a tiempo.`);
}

async function main() {
  execFileSync(process.execPath, [path.join(serverDirectory, 'scripts/init-database.js')], {
    cwd: serverDirectory,
    env,
    stdio: 'inherit',
  });

  const api = start(process.execPath, ['server.js'], serverDirectory);
  await waitFor(`${apiOrigin}/api/v1/health`, api, 'La API');

  const vite = path.join(clientDirectory, 'node_modules/vite/bin/vite.js');
  const client = start(process.execPath, [vite, 'preview', '--host', '0.0.0.0', '--port', String(clientPort), '--strictPort'], clientDirectory);
  await waitFor(clientOrigin, client, 'El cliente');
  console.log(`E2E listo: ${clientOrigin}`);
}

main().catch(error => {
  console.error(error.message);
  shutdown(1);
});
