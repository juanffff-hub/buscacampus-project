const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const healthRoutes = require('./routes/healthRoutes');

const app = express();
app.disable('x-powered-by');
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

app.use('/api/v1/health', healthRoutes);

app.use((req, res) => {
  res.status(404).json({ status: 'ERROR', message: 'Ruta no encontrada.' });
});

module.exports = app;

