const { z } = require('zod');

const reportIdSchema = z.string().regex(/^[1-9]\d*$/, 'El identificador no es válido.');

const listReportsSchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  categoriaId: z.string().regex(/^[1-9]\d*$/).optional(),
  ubicacionId: z.string().regex(/^[1-9]\d*$/).optional(),
  tipoReporte: z.enum(['Perdido', 'Encontrado']).optional(),
  estado: z.enum(['Publicado', 'En reclamación', 'Devuelto']).optional(),
  mios: z.enum(['true', 'false']).default('false').transform(value => value === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

module.exports = { reportIdSchema, listReportsSchema };
