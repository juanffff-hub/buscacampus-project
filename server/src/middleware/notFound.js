const ApiError = require('../errors/ApiError');

function notFound(req, res, next) {
  next(new ApiError(404, 'NOT_FOUND', 'La ruta solicitada no existe.'));
}

module.exports = notFound;
