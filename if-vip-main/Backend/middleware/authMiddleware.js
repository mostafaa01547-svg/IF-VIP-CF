const jwt = require('jsonwebtoken');

// Middleware بيتأكد ان فيه توكن صالح قبل السماح بالوصول لأي مسار محمي
// الباك إند هو مصدر الحقيقة الوحيد لحالة الجلسة - مفيش أي اعتماد على بيانات محفوظة عند العميل فقط
function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

    if (!token) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Session expired or invalid. Please log in again.' });
    }
}

module.exports = { requireAuth };
