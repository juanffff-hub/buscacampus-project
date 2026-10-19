const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ApiError = require('../errors/ApiError');
const userRepository = require('../repositories/userRepository');

function toPublicUser(user) {
  return {
    id: user.id,
    nombreCompleto: user.nombre_completo,
    correoElectronico: user.correo_electronico,
    rol: user.rol,
    estado: user.estado,
    fechaRegistro: user.fecha_registro,
  };
}

async function registerUser({ nombreCompleto, correoElectronico, contrasena }) {
  const contrasenaHash = await bcrypt.hash(contrasena, 12);

  try {
    const user = await userRepository.createUser({
      nombreCompleto,
      correoElectronico,
      contrasenaHash,
    });
    return toPublicUser(user);
  } catch (error) {
    if (error.code === '23505') {
      throw new ApiError(
        409,
        'EMAIL_ALREADY_REGISTERED',
        'Ya existe una cuenta con ese correo institucional.',
      );
    }
    throw error;
  }
}

async function authenticateUser(correoElectronico, contrasena) {
  const user = await userRepository.findByEmail(correoElectronico);
  const validPassword = user
    ? await bcrypt.compare(contrasena, user.contrasena_hash)
    : false;

  if (!user || user.estado !== 'Activo' || !validPassword) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');
  }

  return toPublicUser(user);
}

function issueSessionToken(userId) {
  return jwt.sign(
    { sub: String(userId) },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
  );
}

module.exports = {
  registerUser,
  authenticateUser,
  issueSessionToken,
  toPublicUser,
};
