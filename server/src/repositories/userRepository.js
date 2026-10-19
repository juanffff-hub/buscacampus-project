const pool = require('../config/database');

async function createUser({ nombreCompleto, correoElectronico, contrasenaHash }) {
  const result = await pool.query(
    `INSERT INTO usuarios (nombre_completo, correo_electronico, contrasena_hash)
     VALUES ($1, $2, $3)
     RETURNING id, nombre_completo, correo_electronico, rol, estado, fecha_registro`,
    [nombreCompleto, correoElectronico, contrasenaHash],
  );
  return result.rows[0];
}

async function findByEmail(correoElectronico) {
  const result = await pool.query(
    `SELECT id, nombre_completo, correo_electronico, contrasena_hash,
            rol, estado, fecha_registro
     FROM usuarios
     WHERE LOWER(correo_electronico) = LOWER($1)
     LIMIT 1`,
    [correoElectronico],
  );
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await pool.query(
    `SELECT id, nombre_completo, correo_electronico, rol, estado, fecha_registro
     FROM usuarios
     WHERE id = $1
     LIMIT 1`,
    [id],
  );
  return result.rows[0] || null;
}

module.exports = { createUser, findByEmail, findById };
