const pool = require('../config/database');

async function listCategories() {
  const result = await pool.query(
    `SELECT id::text AS id, nombre, descripcion
     FROM categorias
     ORDER BY nombre ASC, id ASC`,
  );
  return result.rows;
}

async function listLocations() {
  const result = await pool.query(
    `SELECT id::text AS id, nombre_zona AS nombre
     FROM ubicaciones
     WHERE estado = 'Activo'
     ORDER BY nombre_zona ASC, id ASC`,
  );
  return result.rows;
}

module.exports = { listCategories, listLocations };
