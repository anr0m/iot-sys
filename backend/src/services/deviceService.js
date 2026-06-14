const { dbRun, dbGet, dbAll } = require('../models/db');

class DeviceService {
    // ... попередній метод upsertDevice залишається тут ...
    async upsertDevice(deviceId) {
        const sql = `
            INSERT INTO devices (id, last_seen) 
            VALUES (?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET last_seen = CURRENT_TIMESTAMP
        `;
        await dbRun(sql, [deviceId]);
    }

    /**
     * Прив'язує пристрій до користувача
     */
    async linkDevice(userId, deviceId) {
        // 1. Перевіряємо, чи існує такий пристрій (чи надсилав він вже дані)
        const device = await dbGet('SELECT * FROM devices WHERE id = ?', [deviceId]);
        if (!device) {
            throw new Error('Device not found. Make sure the ESP32 is turned on and has sent data at least once.');
        }

        // 2. Створюємо зв'язок у таблиці user_devices
        try {
            await dbRun('INSERT INTO user_devices (user_id, device_id) VALUES (?, ?)', [userId, deviceId]);
            return true;
        } catch (error) {
            // Якщо зв'язок вже існує, SQLite викине помилку UNIQUE constraint
            if (error.message.includes('UNIQUE')) {
                throw new Error('This device is already linked to your account.');
            }
            throw error;
        }
    }

    /**
     * Отримує всі пристрої конкретного користувача з розрахунком статусу online
     */
    async getUserDevices(userId) {
        // Розраховуємо online статус: різниця між поточним часом і last_seen < 15 секунд
        const sql = `
            SELECT d.id as device_id, d.last_seen,
            (strftime('%s', 'now') - strftime('%s', d.last_seen)) < 15 as is_online
            FROM devices d
            JOIN user_devices ud ON d.id = ud.device_id
            WHERE ud.user_id = ?
        `;
        const devices = await dbAll(sql, [userId]);
        
        return devices.map(d => ({
            device_id: d.device_id,
            last_seen: d.last_seen,
            is_online: Boolean(d.is_online)
        }));
    }

    /**
     * Отримує інформацію про конкретний пристрій користувача
     */
    async getDeviceById(userId, deviceId) {
        const sql = `
            SELECT d.id as device_id, d.last_seen,
            (strftime('%s', 'now') - strftime('%s', d.last_seen)) < 15 as is_online
            FROM devices d
            JOIN user_devices ud ON d.id = ud.device_id
            WHERE ud.user_id = ? AND d.id = ?
        `;
        const device = await dbGet(sql, [userId, deviceId]);
        
        if (!device) {
            throw new Error('Device not found or not linked to this account.');
        }

        return {
            device_id: device.device_id,
            last_seen: device.last_seen,
            is_online: Boolean(device.is_online)
        };
    }
}

module.exports = new DeviceService();