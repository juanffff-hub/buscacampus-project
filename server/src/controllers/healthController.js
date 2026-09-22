const pool = require('../config/database');

async function checkHealth(req, res) {
  try {
    const result = await pool.query('SELECT NOW() AS db_time');
    res.status(200).json({
      status: 'OK',
      message: 'Servidor y base de datos disponibles.',
      timestamp: new Date().toISOString(),
      database: { connected: true, db_time: result.rows[0].db_time },
    });
  } catch (error) {
    console.error('Error de conexión a PostgreSQL:', error.message);
    res.status(503).json({
      status: 'ERROR',
      message: 'No se pudo conectar a la base de datos.',
      database: { connected: false },
    });
  }
}

module.exports = { checkHealth };

