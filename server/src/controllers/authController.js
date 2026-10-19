const { registrationSchema } = require('../schemas/authSchemas');
const authService = require('../services/authService');
const { sendSuccess } = require('../utils/responses');

async function register(req, res) {
  const input = registrationSchema.parse(req.body);
  const user = await authService.registerUser(input);
  return sendSuccess(res, { user }, 201);
}

module.exports = { register };
