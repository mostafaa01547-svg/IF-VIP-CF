const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initializeDatabase } = require('./db');
const { registerUser, loginUser, getCurrentUser, logoutUser } = require('./authController');
const { activateLicense, getLicenseStatus, generateLicense } = require('./licenseController');
const { requireAuth } = require('./middleware/authMiddleware');
const { activationLimiter, loginLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/status', (req, res) => {
    res.json({
        status: 'success',
        message: 'IF-VIP Backend Server is running securely!',
        timestamp: new Date()
    });
});

// ---------- Authentication ----------
app.post('/api/auth/register', registerUser);
app.post('/api/auth/login', loginLimiter, loginUser);
app.get('/api/auth/me', requireAuth, getCurrentUser);      // بيتنادى عند فتح التطبيق للتحقق من الجلسة
app.post('/api/auth/logout', requireAuth, logoutUser);

// ---------- Licensing ----------
app.post('/api/license/activate', requireAuth, activationLimiter, activateLicense);
app.get('/api/license/status', requireAuth, getLicenseStatus); // مصدر الحقيقة الوحيد لحالة الرخصة
app.post('/api/license/generate', generateLicense);            // هينتقل لصلاحيات الأدمن في AdminPanel لاحقاً

async function startServer() {
    try {
        await initializeDatabase();
        app.listen(PORT, () => {
            console.log(`IF-VIP Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server due to database error:', error);
    }
}

startServer();
