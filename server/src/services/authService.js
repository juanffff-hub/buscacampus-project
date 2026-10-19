const bcrypt = require('bcryptjs');
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

module.exports = { registerUser, toPublicUser };
