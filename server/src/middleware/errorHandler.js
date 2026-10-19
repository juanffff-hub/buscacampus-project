const { ZodError } = require('zod');
const ApiError = require('../errors/ApiError');
const { sendError } = require('../utils/responses');

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error instanceof ZodError) {
    const details = error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return sendError(res, new ApiError(
      400,
      'VALIDATION_ERROR',
      'Los datos enviados no son válidos.',
      details,
    ));
  }

  if (error instanceof ApiError) return sendError(res, error);

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return sendError(res, new ApiError(
      400,
      'VALIDATION_ERROR',
      'El cuerpo de la solicitud no contiene JSON válido.',
    ));
  }

  return sendError(res, new ApiError(
    500,
    'INTERNAL_SERVER_ERROR',
    'Ocurrió un error inesperado.',
  ));
}

module.exports = errorHandler;
