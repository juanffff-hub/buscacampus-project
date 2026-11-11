const { z } = require('zod');

const claimMessageSchema = z.string().trim().min(10).max(2000);

const createClaimSchema = z.object({
  mensajePrueba: claimMessageSchema,
}).strict();

const claimIdSchema = z.string().regex(/^[1-9]\d*$/, 'El identificador no es válido.');

const listClaimsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

module.exports = {
  createClaimSchema,
  claimIdSchema,
  listClaimsSchema,
};
