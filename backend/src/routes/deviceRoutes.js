const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.post('/link', deviceController.linkDevice);
router.get('/', deviceController.getUserDevices);
router.get('/:id', deviceController.getDevice);

// --- НОВІ РОУТИ ДЛЯ ДАНИХ ---
router.get('/:id/latest', deviceController.getLatestData);
router.get('/:id/history', deviceController.getHistoricalData);

module.exports = router;