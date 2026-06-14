const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Мідлвар для перевірки ролі адміна
const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Forbidden' });
    }
};

// Захищаємо роут подвійно: спочатку наявність токена, потім перевірка ролі
router.use(authenticateToken, requireAdmin);

router.get('/dashboard', adminController.getDashboardData);

router.patch('/users/:id/block', adminController.setUserBlocked);
router.patch('/users/:id/role', adminController.setUserRole);

router.put('/devices/:id/owners', adminController.setDeviceOwners);
router.delete('/devices/:id/history', adminController.clearDeviceHistory);
router.delete('/devices/:id', adminController.deleteDevice);

module.exports = router;