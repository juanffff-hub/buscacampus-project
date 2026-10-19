const { registrationSchema, loginSchema } = require('../schemas/authSchemas');
const authService = require('../services/authService');
const { sendSuccess } = require('../utils/responses');
const { SESSION_COOKIE } = require('../middleware/requireAuth');

async function register(req, res) {
  const input = registrationSchema.parse(req.body);
  const user = await authService.registerUser(input);
  return sendSuccess(res, { user }, 201);
}

async function login(req, res) {
  const input = loginSchema.parse(req.body);
  const user = await authService.authenticateUser(
    input.correoElectronico,
    input.contrasena,
  );
  const token = authService.issueSessionToken(user.id);

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE?.toLowerCase() === 'true',
    path: '/',
  });

  return sendSuccess(res, { user });
}

function me(req, res) {
  return sendSuccess(res, { user: req.user });
}

module.exports = { register, login, me };
