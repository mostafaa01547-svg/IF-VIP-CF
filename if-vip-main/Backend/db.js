const { Pool } = require('pg');
require('dotenv').config();

// إنشاء اتصال بقاعدة بيانات PostgreSQL باستخدام متغيرات البيئة
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // لو بتشتغل محلي ومش مفعل SSL ممكن تشيله أو تظبطه حسب إعدادات جهازك
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// دالة لإنشاء جداول النظام تلقائياً لو مش موجودة
async function initializeDatabase() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. جدول المستخدمين (Users Table)
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_online TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                app_version VARCHAR(20) DEFAULT '1.0.0',
                device_id VARCHAR(100)
            );
        `);

        // 2. جدول التراخيص (Licenses Table)
        await client.query(`
            CREATE TABLE IF NOT EXISTS licenses (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                license_key VARCHAR(100) UNIQUE NOT NULL,
                license_type VARCHAR(50) NOT NULL, -- (3-Day Trial, 1 Month, 1 Year, Lifetime)
                status VARCHAR(20) DEFAULT 'active', -- (active, expired, suspended, revoked)
                activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL
            );
        `);

        await client.query('COMMIT');
        console.log('Database tables (Users, Licenses) initialized successfully.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error initializing database tables:', error);
    } finally {
        client.release();
    }
}

// تشغيل دالة التهيئة عند الاتصال
pool.on('connect', () => {
    console.log('Connected to PostgreSQL database successfully.');
});

module.exports = {
    pool,
    initializeDatabase
};