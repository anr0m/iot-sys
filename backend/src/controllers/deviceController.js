const deviceService = require('../services/deviceService');
const influxService = require('../services/influxService'); // Додали цей рядок! ВАЖЛИВО!

exports.linkDevice = async (req, res) => {
    try {
        const { device_id } = req.body;
        const userId = req.user.id;

        if (!device_id) {
            return res.status(400).json({ success: false, message: 'device_id is required' });
        }

        await deviceService.linkDevice(userId, device_id);
        res.status(200).json({ success: true, message: 'Device linked successfully' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getUserDevices = async (req, res) => {
    try {
        const userId = req.user.id;
        const devices = await deviceService.getUserDevices(userId);
        res.status(200).json({ success: true, devices });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getDevice = async (req, res) => {
    try {
        const userId = req.user.id;
        const deviceId = req.params.id;
        const device = await deviceService.getDeviceById(userId, deviceId);
        res.status(200).json({ success: true, device });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

exports.getLatestData = async (req, res) => {
    try {
        const userId = req.user.id;
        const deviceId = req.params.id;

        await deviceService.getDeviceById(userId, deviceId);

        const data = await influxService.getLatestData(deviceId);
        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('❌ Помилка в getLatestData:', error); // Додали вивід в консоль
        const status = error.message && error.message.includes('not found') ? 404 : 500;
        res.status(status).json({ success: false, message: error.message });
    }
};

exports.getHistoricalData = async (req, res) => {
    try {
        const userId = req.user.id;
        const deviceId = req.params.id;
        const { from, to } = req.query;

        await deviceService.getDeviceById(userId, deviceId);

        const data = await influxService.getHistoricalData(deviceId, from, to);
        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('❌ Помилка в getHistoricalData:', error); // Додали вивід в консоль
        const status = error.message && error.message.includes('not found') ? 404 : 500;
        res.status(status).json({ success: false, message: error.message });
    }
};