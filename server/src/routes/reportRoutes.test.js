const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('../app');
const pool = require('../config/database');
const userRepository = require('../repositories/userRepository');

async function withServer(run) {
  const server = app.listen(0);
  try {
    await new Promise(resolve => server.once('listening', resolve));
    return await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

const reportRow = {
  id: '91',
  titulo: 'Termo verde',
  descripcion: 'Encontrado en la biblioteca.',
  tipoReporte: 'Encontrado',
  estado: 'Publicado',
  fechaHoraEvento: '2026-10-19T15:00:00.000Z',
  fechaCreacion: '2026-10-19T16:00:00.000Z',
  autorId: '7',
  autorNombre: 'Ana Pérez',
  categoriaId: '2',
  categoriaNombre: 'Otros',
  ubicacionId: '3',
  ubicacionNombre: 'Biblioteca',
  imagenId: '101',
  imagenNombreOriginal: 'termo.webp',
  imagenNombreFisico: 'cda48ef7-79ef-4ba0-8d67-b1140da251c2.webp',
  imagenUrl: '/uploads/cda48ef7-79ef-4ba0-8d67-b1140da251c2.webp',
  imagenMimeType: 'image/webp',
  imagenExtension: '.webp',
  imagenPesoBytes: '1024',
  imagenFechaSubida: '2026-10-19T16:00:00.000Z',
};

test('GET /api/v1/categorias y /ubicaciones expone catálogos ordenados y activos', async () => {
  const original = pool.query;
  pool.query = async sql => {
    if (sql.includes('FROM categorias')) {
      assert.match(sql, /ORDER BY nombre ASC/);
      return { rows: [{ id: '1', nombre: 'Documentos', descripcion: 'Carnés.' }] };
    }
    if (sql.includes('FROM ubicaciones')) {
      assert.match(sql, /WHERE estado = 'Activo'/);
      return { rows: [{ id: '3', nombre: 'Biblioteca' }] };
    }
    throw new Error('Consulta de catálogo inesperada.');
  };

  try {
    await withServer(async url => {
      const categoriesResponse = await fetch(`${url}/api/v1/categorias`);
      const categoriesBody = await categoriesResponse.json();
      assert.equal(categoriesResponse.status, 200);
      assert.deepEqual(categoriesBody, {
        success: true,
        data: { items: [{ id: '1', nombre: 'Documentos', descripcion: 'Carnés.' }] },
      });

      const locationsResponse = await fetch(`${url}/api/v1/ubicaciones`);
      const locationsBody = await locationsResponse.json();
      assert.equal(locationsResponse.status, 200);
      assert.deepEqual(locationsBody.data.items, [{ id: '3', nombre: 'Biblioteca' }]);
    });
  } finally {
    pool.query = original;
  }
});

test('GET /api/v1/reportes filtra, pagina e incluye autor, catálogos e imagen', async () => {
  const original = pool.query;
  let listSql;
  let listValues;
  pool.query = async (sql, values) => {
    if (sql.includes('COUNT(*)::text AS total')) return { rows: [{ total: '1' }] };
    listSql = sql;
    listValues = values;
    return { rows: [reportRow] };
  };

  try {
    await withServer(async url => {
      const response = await fetch(
        `${url}/api/v1/reportes?q=termo&categoriaId=1&ubicacionId=2` +
          '&tipoReporte=Encontrado&estado=Publicado&page=2&limit=5',
      );
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.success, true);
      assert.deepEqual(listValues, ['%termo%', '1', '2', 'Encontrado', 'Publicado', 5, 5]);
      assert.match(listSql, /ILIKE \$1/);
      assert.match(listSql, /LIMIT \$6 OFFSET \$7/);
      assert.deepEqual(body.data.pagination, { page: 2, limit: 5, total: 1, totalPages: 1 });
      assert.deepEqual(body.data.items[0], {
        id: '91',
        titulo: 'Termo verde',
        descripcion: 'Encontrado en la biblioteca.',
        tipoReporte: 'Encontrado',
        estado: 'Publicado',
        fechaHoraEvento: '2026-10-19T15:00:00.000Z',
        fechaCreacion: '2026-10-19T16:00:00.000Z',
        autor: { id: '7', nombreCompleto: 'Ana Pérez' },
        categoria: { id: '2', nombre: 'Otros' },
        ubicacion: { id: '3', nombre: 'Biblioteca' },
        imagen: {
          id: '101',
          nombreOriginal: 'termo.webp',
          nombreFisico: 'cda48ef7-79ef-4ba0-8d67-b1140da251c2.webp',
          url: '/uploads/cda48ef7-79ef-4ba0-8d67-b1140da251c2.webp',
          mimeType: 'image/webp',
          extension: '.webp',
          pesoBytes: 1024,
          fechaSubida: '2026-10-19T16:00:00.000Z',
        },
      });
    });
  } finally {
    pool.query = original;
  }
});

test('GET /api/v1/reportes valida filtros y nunca concatena valores enviados', async () => {
  const original = pool.query;
  let queryCount = 0;
  pool.query = async () => {
    queryCount += 1;
    return { rows: [{ total: '0' }] };
  };

  try {
    await withServer(async url => {
      const invalidResponse = await fetch(`${url}/api/v1/reportes?page=0`);
      const invalidBody = await invalidResponse.json();
      assert.equal(invalidResponse.status, 400);
      assert.equal(invalidBody.error.code, 'VALIDATION_ERROR');
      assert.equal(queryCount, 0);

      const validResponse = await fetch(`${url}/api/v1/reportes?q=%27%20OR%201%3D1`);
      assert.equal(validResponse.status, 200);
      assert.equal(queryCount, 2);
    });
  } finally {
    pool.query = original;
  }
});

test('GET /api/v1/reportes?mios=true requiere sesión y filtra por usuario autenticado', async () => {
  const originalQuery = pool.query;
  const originalFindById = userRepository.findById;
  const originalSecret = process.env.JWT_SECRET;
  const secret = 'report-test-secret-with-at-least-thirty-two-bytes';
  let receivedUserValues;
  pool.query = async (sql, values) => {
    if (sql.includes('COUNT(*)::text AS total')) {
      receivedUserValues = values;
      assert.match(sql, /r\.usuario_creador_id = \$1/);
      return { rows: [{ total: '0' }] };
    }
    return { rows: [] };
  };
  userRepository.findById = async id => ({
    id,
    nombre_completo: 'Ana Pérez',
    correo_electronico: 'ana@uao.edu.co',
    rol: 'Usuario',
    estado: 'Activo',
    fecha_registro: '2026-10-19T12:00:00.000Z',
  });
  process.env.JWT_SECRET = secret;

  try {
    await withServer(async url => {
      const unauthorizedResponse = await fetch(`${url}/api/v1/reportes?mios=true`);
      assert.equal(unauthorizedResponse.status, 401);

      const token = jwt.sign({ sub: '7' }, secret, { expiresIn: '1m' });
      const response = await fetch(`${url}/api/v1/reportes?mios=true`, {
        headers: { Cookie: `buscacampus_session=${token}` },
      });
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.deepEqual(receivedUserValues, ['7']);
      assert.deepEqual(body.data.items, []);
    });
  } finally {
    pool.query = originalQuery;
    userRepository.findById = originalFindById;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});

test('GET /api/v1/reportes/:id devuelve detalle y 404 si no existe', async () => {
  const original = pool.query;
  pool.query = async (sql, values) => {
    assert.match(sql, /WHERE r\.id = \$1/);
    assert.equal(values.length, 1);
    return values[0] === '91' ? { rows: [reportRow] } : { rows: [] };
  };

  try {
    await withServer(async url => {
      const foundResponse = await fetch(`${url}/api/v1/reportes/91`);
      const foundBody = await foundResponse.json();
      assert.equal(foundResponse.status, 200);
      assert.equal(foundBody.data.report.id, '91');

      const missingResponse = await fetch(`${url}/api/v1/reportes/999`);
      const missingBody = await missingResponse.json();
      assert.equal(missingResponse.status, 404);
      assert.equal(missingBody.error.code, 'REPORT_NOT_FOUND');
      assert.deepEqual(missingBody.error.details, []);
    });
  } finally {
    pool.query = original;
  }
});
