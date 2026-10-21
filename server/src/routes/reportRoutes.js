const router = require('express').Router();
const { list, getById, create, update, remove } = require('../controllers/reportController');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/requireAuth');
const { uploadReportImage, verifyUploadedImage } = require('../middleware/reportUpload');

function requireAuthForOwnReports(req, res, next) {
  if (req.query.mios === 'true') return requireAuth(req, res, next);
  return next();
}

router.get('/', requireAuthForOwnReports, asyncHandler(list));
router.get('/:id', asyncHandler(getById));
router.post('/', requireAuth, uploadReportImage, verifyUploadedImage, asyncHandler(create));
router.put('/:id', requireAuth, uploadReportImage, verifyUploadedImage, asyncHandler(update));
router.delete('/:id', requireAuth, asyncHandler(remove));

module.exports = router;
