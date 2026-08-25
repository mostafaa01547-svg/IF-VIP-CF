const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');

const TOKEN_EXPIRY = '7d'; // مدة صلاحية جلسة "تذكرني" - السيرفر برضه بيتحقق من حالة اللايسنس كل مرة

function generateToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

// دالة تسجيل مستخدم جديد
async function registerUser(req, res) {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    if (password.length < 8) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    try {
        const userCheck = await pool.query('SELECT id FROM users WHERE email = $1 OR username = $2', [email, username]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Username or Email already exists.' });
        }

        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const newUser = await pool.query(
            `INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at`,
            [username, email, passwordHash]
        );

        // مش بنسجل دخول المستخدم أوتوماتيك - لازم يروح لصفحة اللوجين زي ما اتطلب بالظبط
        return res.status(201).json({
            success: true,
            message: 'Account created successfully. Please log in.',
            user: newUser.rows[0]
        });

    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ success: false, message: 'Server error during registration.' });
    }
}

// دالة تسجيل الدخول
async function loginUser(req, res) {
    const { identifier, password } = req.body; // identifier = username أو email

    if (!identifier || !password) {
        return res.status(400).json({ success: false, message: 'Username/Email and password are required.' });
    }

    try {
        const userResult = await pool.query(
            'SELECT * FROM users WHERE email = $1 OR username = $1',
            [identifier]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const user = userResult.rows[0];
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        await pool.query('UPDATE users SET last_online = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

        const token = generateToken(user.id);

        return res.status(200).json({
            success: true,
            message: 'Login successful!',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                created_at: user.created_at
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ success: false, message: 'Server error during login.' });
    }
}

// دالة التحقق من الجلسة الحالية - بتترجع بيانات المستخدم لو التوكن صالح
// دي اللي بتستخدمها الـ app لما تفتح تاني عشان تعرف تدخل مباشرة ولا لأ
async function getCurrentUser(req, res) {
    try {
        const userResult = await pool.query(
            'SELECT id, username, email, created_at FROM users WHERE id = $1',
            [req.userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Account not found.' });
        }

        return res.status(200).json({ success: true, user: userResult.rows[0] });
    } catch (error) {
        console.error('Session check error:', error);
        return res.status(500).json({ success: false, message: 'Server error during session check.' });
    }
}

function logoutUser(req, res) {
    // الجلسة عبارة عن JWT stateless، فالـ logout الحقيقي بيحصل عند العميل بمسح التوكن المحفوظ.
    // السطر ده موجود عشان يديله استجابة واضحة ويقدر يبني عليه blacklist لو حب مستقبلاً.
    return res.status(200).json({ success: true, message: 'Logged out successfully.' });
}

module.exports = {
    registerUser,
    loginUser,
    getCurrentUser,
    logoutUser
};
