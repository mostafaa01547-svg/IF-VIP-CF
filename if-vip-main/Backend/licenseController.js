const { pool } = require('./db');
const crypto = require('crypto');

// دالة تفعيل رخصة جديدة - المستخدم بييجي من التوكن مش من الـ body عشان محدش يفعّل لحساب غيره
async function activateLicense(req, res) {
    const userId = req.userId;
    const { licenseKey } = req.body;

    if (!licenseKey) {
        return res.status(400).json({ success: false, message: 'License Key is required.' });
    }

    try {
        const licenseCheck = await pool.query(
            'SELECT * FROM licenses WHERE license_key = $1',
            [licenseKey.trim().toUpperCase()]
        );

        if (licenseCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Invalid activation code.' });
        }

        const license = licenseCheck.rows[0];

        if (license.status === 'revoked') {
            return res.status(403).json({ success: false, message: 'This license has been revoked.' });
        }

        if (license.status === 'suspended') {
            return res.status(403).json({ success: false, message: 'This license is currently suspended.' });
        }

        if (license.user_id && license.user_id !== userId) {
            return res.status(400).json({ success: false, message: 'This activation code is already bound to another account.' });
        }

        if (new Date(license.expires_at) < new Date()) {
            return res.status(400).json({ success: false, message: 'This activation code has expired.' });
        }

        const updatedLicense = await pool.query(
            `UPDATE licenses
             SET user_id = $1, activated_at = CURRENT_TIMESTAMP, status = 'active'
             WHERE id = $2
             RETURNING license_type, expires_at, status, activated_at`,
            [userId, license.id]
        );

        return res.status(200).json({
            success: true,
            message: 'License activated successfully!',
            license: updatedLicense.rows[0]
        });

    } catch (error) {
        console.error('License activation error:', error);
        return res.status(500).json({ success: false, message: 'Server error during license activation.' });
    }
}

// دالة التحقق من حالة اللايسنس بتاع المستخدم الحالي
// السيرفر هو المصدر الوحيد للحقيقة هنا - العميل مش بيعتمد على أي تاريخ انتهاء محفوظ عنده
async function getLicenseStatus(req, res) {
    const userId = req.userId;

    try {
        const result = await pool.query(
            `SELECT license_key, license_type, status, expires_at, activated_at
             FROM licenses
             WHERE user_id = $1
             ORDER BY activated_at DESC
             LIMIT 1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(200).json({ success: true, hasLicense: false });
        }

        const license = result.rows[0];
        const isExpired = new Date(license.expires_at) < new Date();

        let effectiveStatus = license.status;
        if (license.status === 'active' && isExpired) {
            effectiveStatus = 'expired';
            // نحدث الحالة في قاعدة البيانات عشان تفضل متسقة
            await pool.query(`UPDATE licenses SET status = 'expired' WHERE license_key = $1`, [license.license_key]);
        }

        return res.status(200).json({
            success: true,
            hasLicense: true,
            license: {
                type: license.license_type,
                status: effectiveStatus,
                expiresAt: license.expires_at,
                activatedAt: license.activated_at
            }
        });
    } catch (error) {
        console.error('License status error:', error);
        return res.status(500).json({ success: false, message: 'Server error while checking license status.' });
    }
}

// دالة توليد رخصة جديدة (للأدمن فقط - هتتنقل لباك إند الأدمن لاحقاً)
async function generateLicense(req, res) {
    const { licenseType, durationDays } = req.body;

    if (!licenseType || !durationDays) {
        return res.status(400).json({ success: false, message: 'License type and duration are required.' });
    }

    try {
        const randomPart = crypto.randomBytes(6).toString('hex').toUpperCase();
        const licenseKey = `IFVIP-${randomPart.slice(0, 4)}-${randomPart.slice(4, 8)}-${randomPart.slice(8, 12)}`;

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(durationDays, 10));

        const newLicense = await pool.query(
            `INSERT INTO licenses (license_key, license_type, expires_at, status)
             VALUES ($1, $2, $3, 'active')
             RETURNING license_key, license_type, expires_at, status`,
            [licenseKey, licenseType, expiresAt]
        );

        return res.status(201).json({
            success: true,
            message: 'License generated successfully!',
            license: newLicense.rows[0]
        });

    } catch (error) {
        console.error('License generation error:', error);
        return res.status(500).json({ success: false, message: 'Server error during license generation.' });
    }
}

module.exports = {
    activateLicense,
    getLicenseStatus,
    generateLicense
};
