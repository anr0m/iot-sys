const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Створюємо або відкриваємо файл бази даних
const dbPath = path.resolve(__dirname, '../../database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening SQLite database:', err.message);
    } else {
        console.log('✅ Connected to SQLite database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // Таблиця користувачів
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Таблиця пристроїв (ESP32)
        db.run(`CREATE TABLE IF NOT EXISTS devices (
            id TEXT PRIMARY KEY, -- наприклад, 'ESP32_01'
            last_seen DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Таблиця зв'язків (Many-to-Many: один юзер - багато девайсів, один девайс - багато юзерів)
        db.run(`CREATE TABLE IF NOT EXISTS user_devices (
            user_id INTEGER,
            device_id TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(device_id) REFERENCES devices(id),
            PRIMARY KEY (user_id, device_id)
        )`);

        db.run(`ALTER TABLE users ADD COLUMN is_blocked INTEGER DEFAULT 0`, () => {});
    });
}

// Прості обгортки для async/await
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

module.exports = { db, dbRun, dbGet, dbAll };