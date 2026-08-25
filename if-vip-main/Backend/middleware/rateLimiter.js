const rateLimit = require('express-rate-limit');

// يمنع محاولات تخمين كود التفعيل أو كلمة المرور بشكل متكرر
const activationLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 دقائق
    max: 10, // 10 محاولات كحد أقصى لكل IP خلال المدة
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many attempts. Please try again later.' }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many login attempts. Please try again later.' }
});

module.exports = { activationLimiter, loginLimiter };
