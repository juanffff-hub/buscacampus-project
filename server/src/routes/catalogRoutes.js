const router = require('express').Router();
const { categories, locations } = require('../controllers/catalogController');
const asyncHandler = require('../middleware/asyncHandler');

router.get('/categorias', asyncHandler(categories));
router.get('/ubicaciones', asyncHandler(locations));

module.exports = router;
