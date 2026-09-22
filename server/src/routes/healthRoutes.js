const router = require('express').Router();
const { checkHealth } = require('../controllers/healthController');

router.get('/', checkHealth);

module.exports = router;

