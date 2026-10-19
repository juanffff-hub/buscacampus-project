const router = require('express').Router();
const { register } = require('../controllers/authController');
const asyncHandler = require('../middleware/asyncHandler');

router.post('/registro', asyncHandler(register));

module.exports = router;
