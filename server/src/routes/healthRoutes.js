const router = require('express').Router();
const { checkHealth } = require('../controllers/healthController');
const asyncHandler = require('../middleware/asyncHandler');

router.get('/', asyncHandler(checkHealth));

module.exports = router;

