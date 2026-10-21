const catalogRepository = require('../repositories/catalogRepository');
const { sendSuccess } = require('../utils/responses');

async function categories(req, res) {
  const items = await catalogRepository.listCategories();
  return sendSuccess(res, { items });
}

async function locations(req, res) {
  const items = await catalogRepository.listLocations();
  return sendSuccess(res, { items });
}

module.exports = { categories, locations };
