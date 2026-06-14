const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbGet, dbRun } = require('../models/db');

class AuthService {
    async register(username, password) {
        // Перевіряємо, чи існує юзер
        const existingUser = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
        if (existingUser) throw new Error('User already exists');

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Якщо це перший користувач, можемо зробити його admin (опціонально)
        const userCount = await dbGet('SELECT COUNT(*) as count FROM users');
        const role = userCount.count === 0 ? 'admin' : 'user';

        const result = await dbRun(
            'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
            [username, hashedPassword, role]
        );

        return { id: result.lastID, username, role };
    }

    async login(username, password) {
        const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
        if (!user) throw new Error('Invalid credentials');

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) throw new Error('Invalid credentials');

        if (user.is_blocked) throw new Error('Account is blocked. Contact administrator.');

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        return { token, user: { id: user.id, username: user.username, role: user.role } };
    }

    async getUserById(id) {
        return await dbGet(
            'SELECT id, username, role, created_at, COALESCE(is_blocked, 0) as is_blocked FROM users WHERE id = ?',
            [id]
        );
    }
}

module.exports = new AuthService();