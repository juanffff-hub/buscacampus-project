const jwt = require('jsonwebtoken');
const ApiError = require('../errors/ApiError');
const asyncHandler = require('./asyncHandler');
const userRepository = require('../repositories/userRepository');
const { toPublicUser } = require('../services/authService');

const SESSION_COOKIE = 'buscacampus_session';

const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token || !process.env.JWT_SECRET) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Debes iniciar sesión para continuar.');
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Debes iniciar sesión para continuar.');
  }

  const user = await userRepository.findById(payload.sub);
  if (!user || user.estado !== 'Activo') {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Debes iniciar sesión para continuar.');
  }

  req.user = toPublicUser(user);
  return next();
});

module.exports = { requireAuth, SESSION_COOKIE };
