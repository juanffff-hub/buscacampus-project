const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const catalogRoutes = require('./routes/catalogRoutes');
const reportRoutes = require('./routes/reportRoutes');
const { UPLOADS_DIR } = require('./middleware/reportUpload');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.disable('x-powered-by');
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', catalogRoutes);
app.use('/api/v1/reportes', reportRoutes);
app.use('/uploads', require('express').static(UPLOADS_DIR, {
  dotfiles: 'deny',
  index: false,
  fallthrough: true,
  maxAge: '1h',
}));

app.use(notFound);
app.use(errorHandler);

module.exports = app;

