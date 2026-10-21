const router = require('express').Router();
const { list, getById } = require('../controllers/reportController');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/requireAuth');

function requireAuthForOwnReports(req, res, next) {
  if (req.query.mios === 'true') return requireAuth(req, res, next);
  return next();
}

router.get('/', requireAuthForOwnReports, asyncHandler(list));
router.get('/:id', asyncHandler(getById));

module.exports = router;
