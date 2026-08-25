// session.js
// إدارة الجلسة (Session) الخاصة بالعميل - بيخزن الـ JWT توكن بس، أبداً مفيش باسورد بيتخزن.
// الباك إند هو مصدر الحقيقة دايماً؛ التخزين المحلي هنا بيستخدم فقط عشان "تذكرني"
// وبيتحقق منه أونلاين في كل مرة قبل ما نسمح بالدخول للتطبيق.

const API_BASE = 'http://localhost:5000/api';

const Session = {
    getToken() {
        return localStorage.getItem('ifvip_token');
    },

    setToken(token, rememberMe) {
        // لو المستخدم مختارش "تذكرني" برضه بنسيب التوكن للجلسة الحالية بس
        // (localStorage في الإلكترون بيفضل موجود بين التشغيلات، فده أبسط حل عملي هنا)
        localStorage.setItem('ifvip_token', token);
        localStorage.setItem('ifvip_remember', rememberMe ? '1' : '0');
    },

    clear() {
        localStorage.removeItem('ifvip_token');
        localStorage.removeItem('ifvip_remember');
        localStorage.removeItem('ifvip_user');
    },

    setUser(user) {
        localStorage.setItem('ifvip_user', JSON.stringify(user));
    },

    getUser() {
        const raw = localStorage.getItem('ifvip_user');
        return raw ? JSON.parse(raw) : null;
    },

    async authFetch(path, options = {}) {
        const token = this.getToken();
        const headers = Object.assign({}, options.headers, {
            'Content-Type': 'application/json'
        });
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers
        });

        let data = null;
        try { data = await response.json(); } catch (_) { /* no body */ }

        return { ok: response.ok, status: response.status, data };
    },

    // بيتنادى عند فتح التطبيق - بيتحقق من الجلسة أونلاين وبيرجع الحالة اللي المفروض التطبيق يفتحها عليها
    async resolveEntryScreen() {
        const token = this.getToken();
        if (!token) return { screen: 'welcome' };

        const meResult = await this.authFetch('/auth/me');
        if (!meResult.ok) {
            this.clear();
            return { screen: 'login', reason: 'session-expired' };
        }
        this.setUser(meResult.data.user);

        const licenseResult = await this.authFetch('/license/status');
        if (!licenseResult.ok) {
            return { screen: 'login', reason: 'session-expired' };
        }

        const { hasLicense, license } = licenseResult.data;

        if (!hasLicense) {
            return { screen: 'activation' };
        }
        if (license.status === 'revoked') {
            return { screen: 'revoked', license };
        }
        if (license.status === 'expired') {
            return { screen: 'expired', license };
        }
        if (license.status === 'suspended') {
            return { screen: 'revoked', license };
        }
        return { screen: 'dashboard', license, user: meResult.data.user };
    }
};

if (typeof module !== 'undefined') {
    module.exports = Session;
}
