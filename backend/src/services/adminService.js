const { dbRun, dbGet, dbAll } = require('../models/db');
const influxService = require('./influxService');

class AdminService {
    async setUserBlocked(adminId, userId, blocked) {
        if (adminId === userId) {
            throw new Error('You cannot block your own account.');
        }

        const user = await dbGet('SELECT id, role FROM users WHERE id = ?', [userId]);
        if (!user) throw new Error('User not found.');

        if (blocked && user.role === 'admin') {
            const adminCount = await dbGet("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND COALESCE(is_blocked, 0) = 0");
            if (adminCount.count <= 1) {
                throw new Error('Cannot block the only active administrator.');
            }
        }

        await dbRun('UPDATE users SET is_blocked = ? WHERE id = ?', [blocked ? 1 : 0, userId]);
        return { id: userId, is_blocked: blocked ? 1 : 0 };
    }

    async setUserRole(adminId, userId, role) {
        if (!['admin', 'user'].includes(role)) {
            throw new Error('Invalid role. Allowed: admin, user.');
        }

        const user = await dbGet('SELECT id, role FROM users WHERE id = ?', [userId]);
        if (!user) throw new Error('User not found.');

        if (user.role === 'admin' && role === 'user') {
            const adminCount = await dbGet("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
            if (adminCount.count <= 1) {
                throw new Error('Cannot demote the only administrator.');
            }
        }

        await dbRun('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
        return { id: userId, role };
    }

    async setDeviceOwners(deviceId, userIds) {
        const device = await dbGet('SELECT id FROM devices WHERE id = ?', [deviceId]);
        if (!device) throw new Error('Device not found.');

        const ids = [...new Set(userIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id)))];
        if (ids.length === 0) {
            await dbRun('DELETE FROM user_devices WHERE device_id = ?', [deviceId]);
            return { device_id: deviceId, owner_ids: [] };
        }

        const placeholders = ids.map(() => '?').join(',');
        const existingUsers = await dbAll(
            `SELECT id FROM users WHERE id IN (${placeholders})`,
            ids
        );
        if (existingUsers.length !== ids.length) {
            throw new Error('One or more user IDs do not exist.');
        }

        await dbRun('DELETE FROM user_devices WHERE device_id = ?', [deviceId]);
        for (const userId of ids) {
            await dbRun('INSERT INTO user_devices (user_id, device_id) VALUES (?, ?)', [userId, deviceId]);
        }

        return { device_id: deviceId, owner_ids: ids };
    }

    async deleteDevice(deviceId, clearHistory = false) {
        const device = await dbGet('SELECT id FROM devices WHERE id = ?', [deviceId]);
        if (!device) throw new Error('Device not found.');

        if (clearHistory) {
            await influxService.deleteDeviceData(deviceId);
        }

        await dbRun('DELETE FROM user_devices WHERE device_id = ?', [deviceId]);
        await dbRun('DELETE FROM devices WHERE id = ?', [deviceId]);

        return { device_id: deviceId, deleted: true };
    }

    async clearDeviceHistory(deviceId) {
        const device = await dbGet('SELECT id FROM devices WHERE id = ?', [deviceId]);
        if (!device) throw new Error('Device not found.');

        await influxService.deleteDeviceData(deviceId);
        return { device_id: deviceId, history_cleared: true };
    }
}

module.exports = new AdminService();
