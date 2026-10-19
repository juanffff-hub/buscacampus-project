const router = require('express').Router();
const { register, login, me } = require('../controllers/authController');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/requireAuth');

router.post('/registro', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.get('/me', requireAuth, asyncHandler(me));

module.exports = router;
