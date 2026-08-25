const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');

// بيشيل الـ Menu Bar الافتراضي (File / Edit / View / Window / Help) من كل شبابيك التطبيق
Menu.setApplicationMenu(null);

let mainWindow;

// خريطة كل شاشة بالمسار بتاعها - بيتضاف هنا أي شاشة جديدة
const SCREENS = {
    welcome: '../Authentication/welcome.html',
    login: '../Authentication/login.html',
    signup: '../Authentication/signup.html',
    'forgot-password': '../Authentication/forgot-password.html',
    activation: '../Authentication/activation.html',
    'activation-success': '../Authentication/activation-success.html',
    expired: '../Authentication/expired.html',
    revoked: '../Authentication/revoked.html',
    dashboard: '../Core/dashboard.html'
};

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 720,
        minWidth: 900,
        minHeight: 620,
        frame: true,
        autoHideMenuBar: true, // احتياطي: حتى لو المنيو رجع لأي سبب، يفضل مخفي
        icon: path.join(__dirname, '../Assets/icon.ico'),
        backgroundColor: '#06060a',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.setMenuBarVisibility(false);

    // أول شاشة دايماً هي الـ Welcome - مش بندخل على الداشبورد مباشرة
    navigateTo('welcome');
}

// بيحمّل الشاشة المطلوبة، وبعد ما تخلص تحميل بيبعتلها أي باراميترز (زي رسالة خطأ أو بيانات لايسنس)
function navigateTo(screen, params = {}) {
    const relativePath = SCREENS[screen];
    if (!relativePath) {
        console.error(`Unknown IF-VIP screen: ${screen}`);
        return;
    }

    mainWindow.loadFile(path.join(__dirname, relativePath));

    mainWindow.webContents.once('did-finish-load', () => {
        const safeParams = JSON.stringify(params || {});
        mainWindow.webContents.executeJavaScript(`window.ifvipNavParams = ${safeParams};`).catch(() => {});
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// كل الشاشات بتنادي navigate بدل ما تعرف مسارات الملفات، عشان الـ routing يبقى مركزي هنا
ipcMain.on('navigate', (event, screen, params) => {
    navigateTo(screen, params);
});
