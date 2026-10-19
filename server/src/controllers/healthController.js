const pool = require('../config/database');
const ApiError = require('../errors/ApiError');
const { sendSuccess } = require('../utils/responses');

async function checkHealth(req, res) {
  let result;
  try {
    result = await pool.query('SELECT NOW() AS db_time');
  } catch {
    throw new ApiError(
      503,
      'DATABASE_UNAVAILABLE',
      'No se pudo conectar a la base de datos.',
    );
  }

  return sendSuccess(res, {
    status: 'OK',
    message: 'Servidor y base de datos disponibles.',
    timestamp: new Date().toISOString(),
    database: { connected: true, db_time: result.rows[0].db_time },
  });
}

module.exports = { checkHealth };

