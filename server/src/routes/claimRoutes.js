const router = require('express').Router();
const claimController = require('../controllers/claimController');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/requireAuth');

router.get('/mias', requireAuth, asyncHandler(claimController.listMine));
router.get('/recibidas', requireAuth, asyncHandler(claimController.listReceived));
router.get('/:id/evidencia', requireAuth, asyncHandler(claimController.getEvidence));
router.patch('/:id/estado', requireAuth, asyncHandler(claimController.updateStatus));
router.get('/:id', requireAuth, asyncHandler(claimController.getById));

module.exports = router;
