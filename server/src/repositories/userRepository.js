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

module.exports = { createUser };
