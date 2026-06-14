const jwt = require('jsonwebtoken');
const { dbGet } = require('../models/db');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
        }

        try {
            const dbUser = await dbGet(
                'SELECT COALESCE(is_blocked, 0) as is_blocked FROM users WHERE id = ?',
                [user.id]
            );
            if (dbUser && dbUser.is_blocked) {
                return res.status(403).json({ success: false, message: 'Account is blocked.' });
            }
            req.user = user;
            next();
        } catch (dbErr) {
            return res.status(500).json({ success: false, message: 'Authentication check failed.' });
        }
    });
};

// Мідлвар для перевірки прав адміна (знадобиться на STEP 10)
const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Admin access required.' });
    }
};

module.exports = { authenticateToken, requireAdmin };