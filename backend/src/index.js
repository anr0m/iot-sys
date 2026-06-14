require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Базові Middleware
app.use(express.json()); // Для парсингу JSON від ESP32 та клієнтів
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. Ініціалізація бази даних SQLite
require('./models/db'); 

// 3. Імпорт роутів
const authRoutes = require('./routes/authRoutes');
const dataRoutes = require('./routes/dataRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const adminRoutes = require('./routes/adminRoutes');

// 4. Підключення API ендпоінтів
app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/admin', adminRoutes);

// 5. Basic Health Check Endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'IoT Platform Backend is running' });
});

// 6. Роздача статики (Фронтенд)
app.use(express.static(path.join(__dirname, '../../frontend'))); 
// Увага: шлях '../frontend' працює, якщо index.js лежить в корені, 
// але оскільки він у папці src, нам треба вийти на два рівні вгору: '../../frontend' або '../frontend' залежно від структури.
// Залишаю '../frontend', як ти просив у попередніх кроках, якщо frontend лежить на одному рівні з src.
app.use(express.static(path.join(__dirname, '../frontend')));

// 7. Глобальний обробник помилок (Error Handling)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 8. Перевірка InfluxDB перед запуском
const influxService = require('./services/influxService');
influxService.checkConnection().then(isConnected => {
    if (!isConnected) {
        console.warn('⚠️ Starting server without InfluxDB connection. Check your database.');
    }
});

// 9. Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});