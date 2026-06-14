const express = require('express');
const router = express.Router();
const dataController = require('../controllers/dataController');

// POST /api/data
router.post('/', dataController.receiveData);

module.exports = router;