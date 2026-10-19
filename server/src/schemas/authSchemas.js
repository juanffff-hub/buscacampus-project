const { z } = require('zod');

const registrationSchema = z.object({
  nombreCompleto: z.string().trim().min(3).max(160),
  correoElectronico: z
    .string()
    .trim()
    .email()
    .transform(value => value.toLowerCase())
    .refine(value => value.endsWith('@uao.edu.co'), {
      message: 'Usa un correo institucional @uao.edu.co.',
    }),
  contrasena: z.string().min(8),
}).strict();

module.exports = { registrationSchema };
