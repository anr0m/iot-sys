const influxService = require('../services/influxService');
const deviceService = require('../services/deviceService');

exports.receiveData = async (req, res) => {
    try {
        const { device_id, payload } = req.body;

        // 1. Базова валідація контракту
        if (!device_id || !Array.isArray(payload)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid payload format. Expected device_id and payload array.' 
            });
        }

        if (payload.length === 0) {
            return res.status(200).json({ success: true, message: 'Empty payload, nothing to save.' });
        }

        // 2. Реєстрація/оновлення статусу девайса (SQLite)
        await deviceService.upsertDevice(device_id);

        // 3. Запис time-series даних сенсорів (InfluxDB)
        await influxService.writeSensorData(device_id, payload);

        // 4. Успішна відповідь для ESP32
        res.status(200).json({ success: true, message: 'Data ingested successfully' });
    } catch (error) {
        console.error('❌ Data ingestion error:', error);
        res.status(500).json({ success: false, message: 'Failed to process sensor data' });
    }
};