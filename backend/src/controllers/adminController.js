const { dbAll } = require('../models/db');
const adminService = require('../services/adminService');

exports.getDashboardData = async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
    }

    try {
        const users = await dbAll(`
            SELECT id, username, role, created_at, COALESCE(is_blocked, 0) as is_blocked
            FROM users ORDER BY created_at DESC
        `);

        const devices = await dbAll(`
            SELECT 
                d.id as device_id, 
                d.last_seen, 
                (strftime('%s', 'now') - strftime('%s', d.last_seen)) < 15 as is_online,
                GROUP_CONCAT(u.username, ', ') as owners,
                GROUP_CONCAT(u.id) as owner_ids
            FROM devices d
            LEFT JOIN user_devices ud ON d.id = ud.device_id
            LEFT JOIN users u ON ud.user_id = u.id
            GROUP BY d.id
            ORDER BY d.last_seen DESC
        `);

        const stats = {
            totalUsers: users.length,
            totalDevices: devices.length,
            onlineDevices: devices.filter(d => d.is_online).length
        };

        res.status(200).json({ success: true, stats, users, devices });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.setUserBlocked = async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        const { blocked } = req.body;
        if (typeof blocked !== 'boolean') {
            return res.status(400).json({ success: false, message: 'Field "blocked" must be a boolean.' });
        }
        const result = await adminService.setUserBlocked(req.user.id, userId, blocked);
        res.json({ success: true, user: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.setUserRole = async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        const { role } = req.body;
        if (!role) {
            return res.status(400).json({ success: false, message: 'Field "role" is required.' });
        }
        const result = await adminService.setUserRole(req.user.id, userId, role);
        res.json({ success: true, user: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.setDeviceOwners = async (req, res) => {
    try {
        const { id: deviceId } = req.params;
        const { user_ids } = req.body;
        if (!Array.isArray(user_ids)) {
            return res.status(400).json({ success: false, message: 'Field "user_ids" must be an array.' });
        }
        const result = await adminService.setDeviceOwners(deviceId, user_ids);
        res.json({ success: true, device: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteDevice = async (req, res) => {
    try {
        const { id: deviceId } = req.params;
        const clearHistory = req.query.clearHistory === 'true';
        const result = await adminService.deleteDevice(deviceId, clearHistory);
        res.json({ success: true, device: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.clearDeviceHistory = async (req, res) => {
    try {
        const { id: deviceId } = req.params;
        const result = await adminService.clearDeviceHistory(deviceId);
        res.json({ success: true, device: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
