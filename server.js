const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const path = require('path');
const fs = require('fs');
const config = require('./config');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

let tempOtpStorage = {};

const app = express();
const PORT = 8080;

const poTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'hexaelitemarket@gmail.com',
        pass: 'zxcpefunexqimpez'
    }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    store: new FileStore({
        path: path.join(__dirname, 'database', 'sessions'),
        ttl: 24 * 60 * 60,
        retries: 0
    }),
    secret: '9f823hf982hf98h2f9h2f98h23f98h23fh',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

const DB_PO_PATH = path.join(__dirname, 'admin', 'produk-po.json');
const ORDER_PO_PATH = path.join(__dirname, 'database', 'user', 'pembelian.json');

const WD_DB_PATH = path.join(__dirname, 'database', 'admin', 'wd-requests.json');

if (!fs.existsSync(WD_DB_PATH)) {
    fs.mkdirSync(path.dirname(WD_DB_PATH), { recursive: true });
    fs.writeFileSync(WD_DB_PATH, JSON.stringify([], null, 2));
}

const MERCHANT_DB_PATH = path.join(__dirname, 'database', 'admin', 'merchant.json');

if (!fs.existsSync(MERCHANT_DB_PATH)) {
    fs.mkdirSync(path.dirname(MERCHANT_DB_PATH), { recursive: true });
    fs.writeFileSync(MERCHANT_DB_PATH, JSON.stringify([], null, 2));
}

const PRODUCTS_DB_PATH = path.join(__dirname, 'database', 'admin', 'products.json');

if (!fs.existsSync(PRODUCTS_DB_PATH)) {
    fs.mkdirSync(path.dirname(PRODUCTS_DB_PATH), { recursive: true });
    fs.writeFileSync(PRODUCTS_DB_PATH, JSON.stringify([]));
}

const REQUEST_ROLE_PATH = path.join(__dirname, 'database', 'user', 'requestrole.json');

if (!fs.existsSync(REQUEST_ROLE_PATH)) {
    fs.mkdirSync(path.dirname(REQUEST_ROLE_PATH), { recursive: true });
    fs.writeFileSync(REQUEST_ROLE_PATH, JSON.stringify([]));
}

const USER_DB_PATH = path.join(__dirname, 'database', 'user', 'user-login.json');

if (!fs.existsSync(USER_DB_PATH)) {
    fs.mkdirSync(path.dirname(USER_DB_PATH), { recursive: true });
    fs.writeFileSync(USER_DB_PATH, JSON.stringify([]));
}

app.get('/docs', (req, res) => {
    fs.readFile(path.join(__dirname, 'public', 'docs.html'), 'utf8', (err, data) => {
        if (err) return res.status(500).send('Error loading docs.html');
        let html = data
            .replace(/\{\{config\.webName\}\}/g, config.webName)
            .replace(/\{\{config\.webUrl\}\}/g, config.webUrl); 
        res.send(html);
    });
});

app.get('/api/admin/toko-products', (req, res) => {
    if (!req.session || !req.session.user || (req.session.user.role !== 'admin' && req.session.user.role !== 'owner')) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    try {
        const fileData = fs.readFileSync(PRODUCTS_DB_PATH, 'utf8');
        const dbProducts = JSON.parse(fileData || '[]');
        const myProducts = dbProducts.filter(p => p.uploadedBy === req.session.user.username);
        res.json({ success: true, data: myProducts });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.get('/api/admin/toko-stats', (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ success: false });
    
    try {
        const productsData = fs.readFileSync(path.join(__dirname, 'database', 'admin', 'products.json'), 'utf8');
        const dbProducts = JSON.parse(productsData || '[]');
        const myProducts = dbProducts.filter(p => p.uploadedBy === req.session.user.username);
        
        const pembeliPath = path.join(__dirname, 'database', 'user', 'pembelian.json');
        let totalOrders = 0;
        let totalPendapatan = 0;
        
        if (fs.existsSync(pembeliPath)) {
            const historyData = JSON.parse(fs.readFileSync(pembeliPath, 'utf8') || '[]');
            const mySales = historyData.filter(h => h.sellerUsername && h.sellerUsername.toLowerCase() === req.session.user.username.toLowerCase());
            
            totalOrders = mySales.length;
            totalPendapatan = mySales.reduce((sum, item) => sum + parseInt(item.finalSellerRevenue || 0), 0);
        }

        res.json({
            success: true,
            data: {
                totalProduk: myProducts.length,
                totalPesanan: totalOrders,
                totalPendapatan: totalPendapatan,
                b5: 0, b4: 0, b3: 0, b2: 0, b1: 0
            }
        });
    } catch (e) {
        res.json({ success: false, message: "Error menghitung statistik" });
    }
});

app.get('/', (req, res) => {
    fs.readFile(path.join(__dirname, 'public', 'index.html'), 'utf8', (err, data) => {
        if (err) return res.status(500).send('Error loading index.html');
        let html = data
            .replace(/\{\{config\.webName\}\}/g, config.webName)
            .replace(/\{\{config\.webNameUpper\}\}/g, config.webName.toUpperCase())
            .replace(/\{\{config\.thumbnailUrl\}\}/g, config.thumbnailUrl)
            .replace(/\{\{config\.descAppPrem\}\}/g, config.descAppPrem)
            .replace(/\{\{config\.descAkunPrem\}\}/g, config.descAkunPrem)
            .replace(/\{\{config\.descEbook\}\}/g, config.descEbook)
            .replace(/\{\{config\.descProdukDigital\}\}/g, config.descProdukDigital)
            .replace(/\{\{config\.descJasa\}\}/g, config.descJasa)
            .replace(/\{\{config\.descLainnya\}\}/g, config.descLainnya);
        res.send(html);
    });
});

app.get('/login', (req, res) => {
    if (req.session && req.session.user) {
        if (req.session.user.role === 'owner') {
            return res.redirect('/owner/dashboard');
        }
        return res.redirect('/dashboard');
    }
    fs.readFile(path.join(__dirname, 'public', 'login.html'), 'utf8', (err, data) => {
        if (err) return res.status(500).send('Error loading login.html');
        let html = data
            .replace(/\{\{config\.webName\}\}/g, config.webName)
            .replace(/\{\{config\.webNameUpper\}\}/g, config.webName.toUpperCase())
            .replace(/\{\{config\.thumbnailUrl\}\}/g, config.thumbnailUrl);
        res.send(html);
    });
});

app.get('/daftar', (req, res) => {
    if (req.session && req.session.user) {
        if (req.session.user.role === 'owner') {
            return res.redirect('/owner/dashboard');
        }
        return res.redirect('/dashboard');
    }
    fs.readFile(path.join(__dirname, 'public', 'daftar.html'), 'utf8', (err, data) => {
        if (err) return res.status(500).send('Error loading daftar.html');
        let html = data
            .replace(/\{\{config\.webName\}\}/g, config.webName)
            .replace(/\{\{config\.webNameUpper\}\}/g, config.webName.toUpperCase());
        res.send(html);
    });
});

app.get('/dashboard', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }

    if (req.session.user.role === 'owner') {
        return res.redirect('/owner/dashboard');
    }

    if (req.session.user.role === 'admin') {
        return res.redirect('/admin/dashboard');
    }
    
    try {
        let users = JSON.parse(fs.readFileSync(USER_DB_PATH, 'utf8'));
        const currentUser = users.find(u => u.username === req.session.user.username);
        const userSaldo = currentUser ? (currentUser.saldo || 0) : 0;

        fs.readFile(path.join(__dirname, 'public', 'dashboard.html'), 'utf8', (err, data) => {
            if (err) return res.status(500).send('Error loading dashboard.html');
            
            let html = data
                .replace(/\{\{config\.webName\}\}/g, config.webName)
                .replace(/\{\{config\.webNameUpper\}\}/g, config.webName.toUpperCase())
                .replace(/Rp 0/g, `Rp ${parseInt(userSaldo).toLocaleString('id-ID')}`);
            res.send(html);
        });
    } catch (e) {
        return res.status(500).send('Database Error');
    }
});

app.get('/api/user-session', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ valid: false, message: 'Sesi tidak valid' });
    }
    let users = JSON.parse(fs.readFileSync(USER_DB_PATH, 'utf8'));
    const currentUser = users.find(u => u.username === req.session.user.username);
    if (currentUser) {
        req.session.user.saldo = currentUser.saldo || 0;
    }
    res.json({ valid: true, user: req.session.user });
});

app.get('/owner/dashboard', (req, res) => {
    if (!req.session || !req.session.user || req.session.user.role !== 'owner') {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'owner', 'dashboard.html'));
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    let users = JSON.parse(fs.readFileSync(USER_DB_PATH, 'utf8'));
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
        return res.status(400).json({ success: false, message: "Email atau kata sandi salah!" });
    }
    
    req.session.user = {
        username: user.username,
        email: user.email,
        nomorHp: user.nomorHp,
        apiKey: user.apiKey,
        role: user.role
    };

    req.session.save((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: "Gagal menyimpan session!" });
        }
        if (user.role === "owner") {
            res.json({ success: true, redirect: "/owner/dashboard" });
        } else if (user.role === "admin") {
            res.json({ success: true, redirect: "/admin/dashboard" });
        } else {
            res.json({ success: true, redirect: "/dashboard" });
        }
    });
});

const DEPOSIT_LOG_PATH = path.join(__dirname, 'database', 'user', 'riwayat-deposit.json');

if (!fs.existsSync(DEPOSIT_LOG_PATH)) {
    fs.mkdirSync(path.dirname(DEPOSIT_LOG_PATH), { recursive: true });
    fs.writeFileSync(DEPOSIT_LOG_PATH, JSON.stringify([]));
}

app.get('/deposit', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    fs.readFile(path.join(__dirname, 'public', 'deposit.html'), 'utf8', (err, data) => {
        if (err) return res.status(500).send('Error loading deposit.html');
        let html = data
            .replace(/\{\{config\.webName\}\}/g, config.webName)
            .replace(/\{\{config\.webNameUpper\}\}/g, config.webName.toUpperCase());
        res.send(html);
    });
});

const QRIS_ID = "a9a2b230-7459-4e93-824b-7018d568d332";
const PACKAGE_IDS = ["com.gojek.gopaymerchant"];
const API_URL = "https://cashify.my.id/api/generate/v2/qris";

app.post('/api/deposit/create', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { amount } = req.body;

    if (!amount || isNaN(amount) || amount < 1000) {
        return res.status(400).json({ success: false, message: 'Nominal minimal Rp 1.000' });
    }

    try {
        const payload = {
            qr_id: QRIS_ID,
            amount: parseInt(amount),
            useUniqueCode: true,
            packageIds: PACKAGE_IDS,
            expiredInMinutes: 15,
            qrType: "dynamic",
            paymentMethod: "qris",
            useQris: true
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.status === 200 && result.data) {
            res.json({ 
                success: true, 
                data: result.data 
            });
        } else {
            res.status(400).json({ 
                success: false, 
                message: result.message || 'Gagal generate QRIS dari provider' 
            });
        }

    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error saat hit API' });
    }
});

const CHECK_API_URL = "https://cashify.my.id/api/generate/check-status";

app.post('/api/deposit/check', async (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    
    const { trx_id } = req.body;
    if (!trx_id) return res.status(400).json({ success: false, message: 'TRX ID dibutuhkan' });
    
    try {
        const payload = {
            transactionId: trx_id
        };

        const response = await fetch(CHECK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        
        if (result.status === 200 && result.data) {
            const currentStatus = result.data.status;
            
            if (currentStatus === 'paid') {
                let logs = JSON.parse(fs.readFileSync(DEPOSIT_LOG_PATH, 'utf8'));
                const isExist = logs.some(l => l.trx_id === trx_id);

                if (!isExist) {
                    let users = JSON.parse(fs.readFileSync(USER_DB_PATH, 'utf8'));
                    const userIndex = users.findIndex(u => u.username === req.session.user.username);
                    
                    if (userIndex !== -1) {
                        let currentSaldo = parseInt(users[userIndex].saldo || 0);
                        users[userIndex].saldo = currentSaldo + parseInt(result.data.amount);
                        fs.writeFileSync(USER_DB_PATH, JSON.stringify(users, null, 2));
                        
                        req.session.user.saldo = users[userIndex].saldo;
                        return req.session.save((err) => {
                            if (err) return res.status(500).json({ success: false, message: 'Gagal update session' });
                            
                            const newLog = {
                                username: req.session.user.username,
                                trx_id: trx_id,
                                amount: parseInt(result.data.amount),
                                status: "SUCCESS",
                                date: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
                            };
                            logs.push(newLog);
                            fs.writeFileSync(DEPOSIT_LOG_PATH, JSON.stringify(logs, null, 2));
                            
                            return res.json({ success: true, status: currentStatus, amount: result.data.amount });
                        });
                    }
                }
            }
            
            return res.json({ success: true, status: currentStatus, amount: result.data.amount });
        } else {
            return res.status(400).json({ success: false, message: result.message || 'Gagal cek status ke provider' });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error saat cek status' });
    }
});

app.get('/api/deposit/history', (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ success: false });
    let logs = JSON.parse(fs.readFileSync(DEPOSIT_LOG_PATH, 'utf8'));
    const userLogs = logs.filter(l => l.username.toLowerCase() === req.session.user.username.toLowerCase());
    res.json({ success: true, data: userLogs });
});

app.get('/api/users-all', (req, res) => {
    if (!req.session || !req.session.user || req.session.user.role !== 'owner') {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    let users = JSON.parse(fs.readFileSync(USER_DB_PATH, 'utf8'));
    res.json({ success: true, data: users });
});

app.get('/api/deposit/history-all', (req, res) => {
    if (!req.session || !req.session.user || req.session.user.role !== 'owner') {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    let logs = JSON.parse(fs.readFileSync(DEPOSIT_LOG_PATH, 'utf8'));
    res.json({ success: true, data: logs });
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

app.post('/api/user/request-role', (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { roleRequested, alasan } = req.body;
    
    if (roleRequested !== 'admin') return res.status(400).json({ success: false, message: 'Role tidak valid!' });

    let requests = JSON.parse(fs.readFileSync(REQUEST_ROLE_PATH, 'utf8'));
    
    const hasPending = requests.some(r => r.username === req.session.user.username && r.status === 'PENDING');
    if (hasPending) {
        return res.status(400).json({ success: false, message: 'Kamu sudah memiliki pengajuan yang berstatus PENDING!' });
    }

    const newRquest = {
        trx_id: 'REQ-' + Math.floor(100000 + Math.random() * 900000),
        id: 'REQ-' + Math.floor(100000 + Math.random() * 900000),
        username: req.session.user.username,
        email: req.session.user.email,
        roleRequested,
        alasan,
        status: "PENDING",
        date: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
    };

    requests.push(newRequest);
    fs.writeFileSync(REQUEST_ROLE_PATH, JSON.stringify(requests, null, 2));
    res.json({ success: true, message: 'Permintaan berhasil dikirim! Menunggu persetujuan Owner.' });
});

app.get('/api/owner/request-role/list', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    let requests = JSON.parse(fs.readFileSync(REQUEST_ROLE_PATH, 'utf8'));
    if (req.session.user.role === 'owner') {
        return res.json({ success: true, data: requests });
    }
    const userRequests = requests.filter(r => r.username.toLowerCase() === req.session.user.username.toLowerCase());
    res.json({ success: true, data: userRequests });
});

app.get('/api/owner/request-list', (req, res) => {
    if (!req.session || !req.session.user || req.session.user.role !== 'owner') {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    let requests = JSON.parse(fs.readFileSync(REQUEST_ROLE_PATH, 'utf8'));
    res.json({ success: true, data: requests });
});

app.post('/api/owner/request-role/action', (req, res) => {
    if (!req.session || !req.session.user || req.session.user.role !== 'owner') {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const { id, status } = req.body; 

    let requests = JSON.parse(fs.readFileSync(REQUEST_ROLE_PATH, 'utf8'));
    const reqIndex = requests.findIndex(r => r.trx_id === id || r.id === id);

    if (reqIndex === -1) return res.status(404).json({ success: false, message: 'Data pengajuan tidak ditemukan!' });
    if (requests[reqIndex].status !== 'PENDING') return res.status(400).json({ success: false, message: 'Pengajuan sudah diproses sebelumnya!' });

    const targetUsername = requests[reqIndex].username;

    if (status === 'SUCCESS') {
        requests[reqIndex].status = 'SUCCESS';
        let users = JSON.parse(fs.readFileSync(USER_DB_PATH, 'utf8'));
        const userIndex = users.findIndex(u => u.username === targetUsername);
        if (userIndex !== -1) {
            users[userIndex].role = 'admin';
            fs.writeFileSync(USER_DB_PATH, JSON.stringify(users, null, 2));
        }
    } else {
        requests[reqIndex].status = 'REJECTED';
    }

    fs.writeFileSync(REQUEST_ROLE_PATH, JSON.stringify(requests, null, 2));
    res.json({ success: true, message: `Berhasil mengubah status pengajuan menjadi ${status}!` });
});

app.post('/api/owner/request-action', (req, res) => {
    if (!req.session || !req.session.user || req.session.user.role !== 'owner') {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const { trx_id, action } = req.body;

    let requests = JSON.parse(fs.readFileSync(REQUEST_ROLE_PATH, 'utf8'));
    const reqIndex = requests.findIndex(r => r.trx_id === trx_id);

    if (reqIndex === -1) return res.status(404).json({ success: false, message: 'Data pengajuan tidak ditemukan!' });
    if (requests[reqIndex].status !== 'PENDING') return res.status(400).json({ success: false, message: 'Pengajuan sudah diproses sebelumnya!' });

    const targetUsername = requests[reqIndex].username;

    if (action === 'APPROVE') {
        requests[reqIndex].status = 'SUCCESS';
        let users = JSON.parse(fs.readFileSync(USER_DB_PATH, 'utf8'));
        const userIndex = users.findIndex(u => u.username === targetUsername);
        if (userIndex !== -1) {
            users[userIndex].role = 'admin';
            fs.writeFileSync(USER_DB_PATH, JSON.stringify(users, null, 2));
        }
    } else {
        requests[reqIndex].status = 'REJECTED';
    }

    fs.writeFileSync(REQUEST_ROLE_PATH, JSON.stringify(requests, null, 2));
    res.json({ success: true, message: `Berhasil melakukan ${action} pada pengajuan!` });
});

app.get('/admin/dashboard', (req, res) => {
    if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'admin', 'dashboard.html'));
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.use('/owner', (req, res, next) => {
    if (!req.session || !req.session.user || req.session.user.role !== 'owner') {
        return res.redirect('/login');
    }
    next();
}, express.static(path.join(__dirname, 'owner'), { extensions: ['html'] }));

app.use('/admin', (req, res, next) => {
    if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/login');
    }

    if (req.path === '/list-produk.html' || req.path === '/list-produk') {
        return res.sendFile(path.join(__dirname, 'public', 'list-produk.html'));
    }
    if (req.path === '/detailproduk.html' || req.path === '/detailproduk') {
        return res.sendFile(path.join(__dirname, 'public', 'detailproduk.html'));
    }

    next();
}, express.static(path.join(__dirname, 'admin'), { extensions: ['html'] }));

app.get('/listproduk.html', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'listproduk.html'));
});

app.get('/detailproduk.html', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'detailproduk.html'));
});

app.post('/api/admin/merchant/save', (req, res) => {
    if (!req.session || !req.session.user || (req.session.user.role !== 'admin' && req.session.user.role !== 'owner')) {
        return res.status(403).json({ success: false, message: 'Akses Ditolak! Anda bukan admin.' });
    }

    const { namaToko, emailPemilik, nomorPemilik, metodePencairan, nomorPencairan } = req.body;

    if (!namaToko || !emailPemilik || !nomorPemilik || !metodePencairan || !nomorPencairan) {
        return res.status(400).json({ success: false, message: 'Semua kolom input wajib diisi!' });
    }

    try {
        let merchants = [];
        if (fs.existsSync(MERCHANT_DB_PATH)) {
            merchants = JSON.parse(fs.readFileSync(MERCHANT_DB_PATH, 'utf8'));
        }

        const isExist = merchants.some(m => m.namaToko.toLowerCase() === namaToko.toLowerCase() || m.emailPemilik.toLowerCase() === emailPemilik.toLowerCase());
        if (isExist) {
            return res.status(400).json({ success: false, message: 'Nama toko atau Email pemilik sudah terdaftar!' });
        }

        const newMerchant = {
            merchant_id: 'MCH-' + Math.floor(100000 + Math.random() * 900000),
            createdBy: req.session.user.username,
            namaToko,
            emailPemilik,
            nomorPemilik,
            metodePencairan,
            nomorPencairan,
            status: "ACTIVE",
            dateCreated: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
        };

        merchants.push(newMerchant);
        fs.writeFileSync(MERCHANT_DB_PATH, JSON.stringify(merchants, null, 2));

        res.json({ success: true, message: 'Toko Merchant berhasil dibuat & disimpan ke database!' });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal memproses pendaftaran data merchant.' });
    }
});

app.get('/api/admin/merchant/info', (req, res) => {
    if (!req.session || !req.session.user || (req.session.user.role !== 'admin' && req.session.user.role !== 'owner')) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    try {
        if (!fs.existsSync(MERCHANT_DB_PATH)) {
            return res.json({ success: false, message: 'Data belum ada' });
        }
        const merchants = JSON.parse(fs.readFileSync(MERCHANT_DB_PATH, 'utf8'));
        const myMerchant = merchants.find(m => m.createdBy === req.session.user.username);
        
        if (myMerchant) {
            res.json({ success: true, data: myMerchant });
        } else {
            res.json({ success: false, message: 'Merchant belum terkonfigurasi' });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.post('/api/admin/product/save', (req, res) => {
    if (!req.session || !req.session.user || (req.session.user.role !== 'admin' && req.session.user.role !== 'owner')) {
        return res.status(403).json({ success: false, message: 'Akses ditolak, silakan login admin!' });
    }

    try {
        const newProduct = req.body;
        let namaMerchant = "Belum Dibuat";

        if (fs.existsSync(MERCHANT_DB_PATH)) {
            const merchants = JSON.parse(fs.readFileSync(MERCHANT_DB_PATH, 'utf8') || '[]');
            const myMerchant = merchants.find(m => m.createdBy === req.session.user.username);
            if (myMerchant && myMerchant.namaToko) {
                namaMerchant = myMerchant.namaToko;
            }
        }

        const fileData = fs.readFileSync(PRODUCTS_DB_PATH, 'utf8');
        const dbProducts = JSON.parse(fileData || '[]');

        newProduct.merchantName = namaMerchant.toUpperCase();
        newProduct.uploadedBy = req.session.user.username;
        newProduct.createdAt = new Date().toISOString();
        
        dbProducts.push(newProduct);

        fs.writeFileSync(PRODUCTS_DB_PATH, JSON.stringify(dbProducts, null, 4), 'utf8');
        
        res.json({ success: true, message: 'Produk berhasil disimpan ke database!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Gagal memproses penulisan ke sistem berkas json' });
    }
});

app.post('/api/order/checkout', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ success: false, message: 'Silakan login terlebih dahulu untuk bertransaksi!' });
    }

    const orderPayload = req.body;
    const buyerUsername = req.session.user.username;
    const totalGrossPrice = parseInt(orderPayload.totalGrossPrice || 0);
    const finalSellerRevenue = parseInt(orderPayload.finalSellerRevenue || 0);
    const buyQty = parseInt(orderPayload.quantity || 1);

    try {
        let products = JSON.parse(fs.readFileSync(PRODUCTS_DB_PATH, 'utf8') || '[]');
        const productIndex = products.findIndex(p => String(p.productId) === String(orderPayload.productId) || String(p.id) === String(orderPayload.productId));
        
        if (productIndex === -1) {
            return res.status(404).json({ success: false, message: 'Produk tidak valid atau telah dihapus oleh merchant!' });
        }

        const variantIndex = products[productIndex].items.findIndex(item => item.subName === orderPayload.subName);
        if (variantIndex === -1) {
            return res.status(404).json({ success: false, message: 'Opsi varian produk tidak ditemukan!' });
        }

        let currentStock = parseInt(products[productIndex].items[variantIndex].stok || 0);

        if (currentStock < buyQty) {
            return res.status(400).json({ success: false, message: `Gagal! Stok tidak mencukupi. Sisa stok saat ini: ${currentStock}` });
        }

        let users = JSON.parse(fs.readFileSync(USER_DB_PATH, 'utf8') || '[]');
        
        const buyerIndex = users.findIndex(u => u.username === buyerUsername);
        if (buyerIndex === -1) {
            return res.status(404).json({ success: false, message: 'Data akun pembeli tidak ditemukan!' });
        }

        let buyerSaldo = parseInt(users[buyerIndex].saldo || 0);
        if (buyerSaldo < totalGrossPrice) {
            return res.status(400).json({ success: false, message: 'Saldo Anda tidak mencukupi! Silakan lakukan deposit terlebih dahulu.' });
        }

        const sellerUsername = products[productIndex].uploadedBy;

        products[productIndex].items[variantIndex].stok = currentStock - buyQty;
        fs.writeFileSync(PRODUCTS_DB_PATH, JSON.stringify(products, null, 4), 'utf8');

        users[buyerIndex].saldo = buyerSaldo - totalGrossPrice;
        
        const sellerIndex = users.findIndex(u => u.username === sellerUsername);
        if (sellerIndex !== -1) {
            let sellerSaldo = parseInt(users[sellerIndex].saldo || 0);
            users[sellerIndex].saldo = sellerSaldo + finalSellerRevenue;
        }

        fs.writeFileSync(USER_DB_PATH, JSON.stringify(users, null, 2));

        req.session.user.saldo = users[buyerIndex].saldo;

        orderPayload.invoiceId = 'INV-' + Date.now() + Math.floor(1000 + Math.random() * 9000);
        orderPayload.buyerUsername = buyerUsername;
        orderPayload.sellerUsername = sellerUsername;
        orderPayload.createdAt = new Date().toISOString();

        const dirPath = path.join(__dirname, 'database', 'user');
        const filePath = path.join(dirPath, 'pembelian.json');

        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        let historyData = [];
        if (fs.existsSync(filePath)) {
            try {
                historyData = JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]');
            } catch (e) {
                historyData = [];
            }
        }

        historyData.push(orderPayload);
        fs.writeFileSync(filePath, JSON.stringify(historyData, null, 4), 'utf8');

        const dataRahasia = products[productIndex].items[variantIndex].dataRahasia || 'BERKAS-RAHASIA-TIDAK-TERSEDIA';

        res.json({ 
            success: true, 
            message: 'Transaksi sukses terekam dan stok berhasil diperbarui.',
            dataRahasia: dataRahasia
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem saat memproses pengurangan stok dan transaksi.' });
    }
});

app.get('/api/products', (req, res) => {
    try {
        if (!fs.existsSync(PRODUCTS_DB_PATH)) {
            return res.json({ success: true, data: [] });
        }
        const fileData = fs.readFileSync(PRODUCTS_DB_PATH, 'utf8');
        const dbProducts = JSON.parse(fileData || '[]');
        
        let filteredProducts = dbProducts;
        if (req.session && req.session.user) {
            filteredProducts = dbProducts.filter(p => p.uploadedBy.toLowerCase() !== req.session.user.username.toLowerCase());
        }
        
        const calibratedProducts = filteredProducts.map(product => {
            const linkGambarAsli = product.imageUrl || product.image || product.imageurl || '';
            
            product.image = linkGambarAsli;
            product.imageUrl = linkGambarAsli;
            product.imageurl = linkGambarAsli;
            
            if (!product.items || !Array.isArray(product.items)) {
                product.items = [];
            }
            
            return product;
        });

        res.json({ success: true, data: calibratedProducts });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal memproses permintaan' });
    }
});

app.get('/api/products/:id', (req, res) => {
    try {
        if (!fs.existsSync(PRODUCTS_DB_PATH)) {
            return res.status(404).json({ success: false, message: 'Database tidak ditemukan' });
        }
        const fileData = fs.readFileSync(PRODUCTS_DB_PATH, 'utf8');
        const dbProducts = JSON.parse(fileData || '[]');
        
        const targetProduct = dbProducts.find(p => 
            String(p.productId) === String(req.params.id) || 
            String(p.id) === String(req.params.id)
        );
        
        if (targetProduct) {
            const linkGambarAsli = targetProduct.imageUrl || targetProduct.image || targetProduct.imageurl || '';
            targetProduct.image = linkGambarAsli;
            targetProduct.imageUrl = linkGambarAsli;
            targetProduct.imageurl = linkGambarAsli;

            if (targetProduct.reviews && targetProduct.reviews.length > 0) {
                const totalRating = targetProduct.reviews.reduce((sum, rev) => sum + rev.rating, 0);
                targetProduct.ratingDecimal = parseFloat((totalRating / targetProduct.reviews.length).toFixed(1));
            } else {
                targetProduct.ratingDecimal = 0;
                targetProduct.rating = 0;
            }
            
            res.json({ success: true, data: targetProduct });
        } else {
            res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal membaca database' });
    }
});

app.get('/api/order/history', (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ success: false });
    
    const pembelianPath = path.join(__dirname, 'database', 'user', 'pembelian.json');
    const productsPath = path.join(__dirname, 'database', 'admin', 'products.json');
    
    if (!fs.existsSync(pembelianPath)) {
        return res.json({ success: true, data: [] });
    }
    
    try {
        const historyData = JSON.parse(fs.readFileSync(pembelianPath, 'utf8') || '[]');
        const productsData = fs.existsSync(productsPath) ? JSON.parse(fs.readFileSync(productsPath, 'utf8') || '[]') : [];
        
        const userHistory = historyData.filter(h => h.buyerUsername && String(h.buyerUsername).toLowerCase() === String(req.session.user.username).toLowerCase());
        
        const completeHistory = userHistory.map(trx => {
            const productMatch = productsData.find(p => 
                String(p.productId) === String(trx.productId) || 
                String(p.id) === String(trx.productId)
            );
            
            let accountData = { 
                category: "AKUN PREMIUM", 
                imageUrl: "", email: "-", pw: "-", linkApk: "", a2f: "-", deskripsiExt: "-", urlProduk: "" 
            };
            
            if (productMatch) {
                accountData.category = productMatch.category || "AKUN PREMIUM";
                accountData.imageUrl = productMatch.imageUrl || "";
                
                if (productMatch.items && productMatch.items.length > 0) {
                    const variantMatch = productMatch.items.find(v => v.subName === trx.subName);
                    if (variantMatch) {
                        accountData.email = variantMatch.email || "-";
                        accountData.pw = variantMatch.pw || "-";
                        accountData.linkApk = variantMatch.linkApk || "";
                        accountData.a2f = variantMatch.a2f || "OFF";
                        accountData.deskripsiExt = variantMatch.deskripsiExt || "-";
                        accountData.urlProduk = variantMatch.urlProduk || "";
                    }
                }
            } else {
                accountData.category = trx.category || "PRODUK";
                accountData.email = trx.email || "-";
                accountData.pw = trx.pw || "-";
                accountData.linkApk = trx.linkApk || "";
                accountData.urlProduk = trx.urlProduk || "";
            }
            
            return { ...trx, ...accountData };
        });

        res.json({ success: true, data: completeHistory });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, data: [] });
    }
});

app.post('/api/order/rate', (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ success: false, message: "Unauthorized" });
    
    const { invoiceId, productId, rating, comment } = req.body;
    const cleanRating = parseInt(rating);
    
    if (!invoiceId || !productId || !cleanRating || cleanRating < 1 || cleanRating > 5) {
        return res.status(400).json({ success: false, message: "Data tidak valid atau rating harus 1-5" });
    }

    try {
        const pembelianPath = path.join(__dirname, 'database', 'user', 'pembelian.json');
        const productsPath = path.join(__dirname, 'database', 'admin', 'products.json');

        if (!fs.existsSync(pembelianPath) || !fs.existsSync(productsPath)) {
            return res.status(404).json({ success: false, message: "Database tidak ditemukan" });
        }

        let pembelianData = JSON.parse(fs.readFileSync(pembelianPath, 'utf8') || '[]');
        let productsData = JSON.parse(fs.readFileSync(productsPath, 'utf8') || '[]');

        const trxIndex = pembelianData.findIndex(h => h.invoiceId === invoiceId && h.buyerUsername?.toLowerCase() === req.session.user.username.toLowerCase());
        if (trxIndex === -1) return res.status(404).json({ success: false, message: "Transaksi tidak ditemukan" });
        if (pembelianData[trxIndex].isRated) return res.status(400).json({ success: false, message: "Transaksi ini sudah kamu beri rating" });

        const prodIndex = productsData.findIndex(p => p.id === productId || p.productId === productId);
        if (prodIndex !== -1) {
            let product = productsData[prodIndex];
            
            if (!product.reviews) product.reviews = [];
            
            product.reviews.push({
                username: req.session.user.username,
                rating: cleanRating,
                comment: comment || "Tidak ada ulasan.",
                date: new Date().toISOString()
            });

            const totalRating = product.reviews.reduce((sum, rev) => sum + rev.rating, 0);
            product.ratingDecimal = parseFloat((totalRating / product.reviews.length).toFixed(1));
            
            productsData[prodIndex] = product;
            fs.writeFileSync(productsPath, JSON.stringify(productsData, null, 4), 'utf8');
        }

        pembelianData[trxIndex].isRated = true;
        pembelianData[trxIndex].userRating = cleanRating;
        pembelianData[trxIndex].userComment = comment || "";
        fs.writeFileSync(pembelianPath, JSON.stringify(pembelianData, null, 4), 'utf8');

        res.json({ success: true, message: "Terima kasih! Rating berhasil disimpan." });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: "Gagal menyimpan rating akibat error internal" });
    }
});

app.get('/api/admin/finance-stats', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'database', 'user', 'pembelian.json');
        
        if (!fs.existsSync(filePath)) {
            return res.json({ success: true, data: [] });
        }

        const rawData = fs.readFileSync(filePath, 'utf8');
        const invoices = JSON.parse(rawData || '[]');

        res.json({
            success: true,
            data: invoices
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Gagal membaca data database" });
    }
});

app.post('/api/admin/product/delete', (req, res) => {
    if (!req.session || !req.session.user || (req.session.user.role !== 'admin' && req.session.user.role !== 'owner')) {
        return res.status(403).json({ success: false, message: 'Akses ditolak!' });
    }

    const { productId } = req.body;
    if (!productId) return res.status(400).json({ success: false, message: 'ID produk tidak dikirim!' });

    try {
        const fileData = fs.readFileSync(PRODUCTS_DB_PATH, 'utf8');
        let dbProducts = JSON.parse(fileData || '[]');

        const itemIndex = dbProducts.findIndex(p => String(p.productId) === String(productId) || String(p.id) === String(productId));
        
        if (itemIndex === -1) {
            return res.status(404).json({ success: false, message: 'Produk tidak ditemukan di database!' });
        }

        if (dbProducts[itemIndex].uploadedBy !== req.session.user.username) {
            return res.status(403).json({ success: false, message: 'Anda tidak diizinkan menghapus produk milik toko lain!' });
        }

        dbProducts.splice(itemIndex, 1);

        fs.writeFileSync(PRODUCTS_DB_PATH, JSON.stringify(dbProducts, null, 4), 'utf8');
        
        res.json({ success: true, message: 'Produk berhasil dihapus.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Gagal memproses penghapusan berkas database' });
    }
});

app.get('/api/admin/penarikan/riwayat', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
        const username = req.session.user.username;

        if (!fs.existsSync(WD_DB_PATH)) {
            return res.json({ success: true, data: [] });
        }

        const wdData = fs.readFileSync(WD_DB_PATH, 'utf8');
        const dbWd = JSON.parse(wdData || '[]');

        const filteredWd = dbWd.filter(wd => String(wd.username).toLowerCase() === String(username).toLowerCase());

        res.json({ success: true, data: filteredWd });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Gagal mengambil riwayat penarikan' });
    }
});

app.get('/api/owner/penarikan/list', (req, res) => {
    if (!req.session || !req.session.user || req.session.user.role !== 'owner') {
        return res.status(403).json({ success: false, message: 'Akses ditolak!' });
    }

    try {
        if (!fs.existsSync(WD_DB_PATH)) {
            return res.json({ success: true, data: [] });
        }
        const wdData = fs.readFileSync(WD_DB_PATH, 'utf8');
        const dbWd = JSON.parse(wdData || '[]');
        res.json({ success: true, data: dbWd });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal memuat data penarikan' });
    }
});

app.post('/api/admin/penarikan/request', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ success: false, message: 'Sesi habis, silakan login kembali!' });
    }

    const { nominal, metode, tujuan } = req.body;
    if (!nominal || !metode || !tujuan) {
        return res.status(400).json({ success: false, message: 'Data request tidak lengkap!' });
    }

    try {
        const usersPath = path.join(__dirname, 'database', 'user', 'user-login.json');
        const wdPath = path.join(__dirname, 'database', 'admin', 'wd-requests.json');

        if (!fs.existsSync(usersPath) || !fs.existsSync(wdPath)) {
            return res.status(500).json({ success: false, message: 'Sistem Error: Database tidak ditemukan!' });
        }

        let usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8') || '[]');
        let wdData = JSON.parse(fs.readFileSync(wdPath, 'utf8') || '[]');

        const loggedInUsername = req.session.user.username;
        const userIndex = usersData.findIndex(u => String(u.username).toLowerCase() === String(loggedInUsername).toLowerCase());

        if (userIndex === -1) {
            return res.status(404).json({ success: false, message: 'Akun admin tidak ditemukan di database!' });
        }

        const currentSaldo = parseInt(usersData[userIndex].saldo || 0);
        const nominalWd = parseInt(nominal);

        if (currentSaldo < nominalWd) {
            return res.status(400).json({ success: false, message: 'Saldo Anda tidak mencukupi untuk melakukan penarikan!' });
        }

        usersData[userIndex].saldo = currentSaldo - nominalWd;
        req.session.user.saldo = usersData[userIndex].saldo;

        const newWdRequest = {
            wdId: "WD" + Date.now() + Math.floor(1000 + Math.random() * 9000),
            username: usersData[userIndex].username,
            nominal: nominalWd,
            metodePencairan: metode,
            nomorPencairan: tujuan,
            status: "PENDING",
            tanggalRequest: new Date().toLocaleString('id-ID'),
            keterangan: "Menunggu transfer dari owner"
        };

        wdData.push(newWdRequest);

        fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 4), 'utf8');
        fs.writeFileSync(wdPath, JSON.stringify(wdData, null, 4), 'utf8');

        res.json({ success: true, message: 'Permintaan penarikan berhasil dikirim ke Owner!' });
    } catch (error) {
        console.error("Error pada /api/admin/penarikan/request:", error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan internal pada server' });
    }
});


app.post('/api/owner/penarikan/action', (req, res) => {
    if (!req.session || !req.session.user || req.session.user.role !== 'owner') {
        return res.status(403).json({ success: false, message: 'Akses ditolak!' });
    }

    const { wdId, action } = req.body;
    if (!wdId || !action) {
        return res.status(400).json({ success: false, message: 'Data tidak lengkap!' });
    }

    try {
        const wdPath = path.join(__dirname, 'database', 'admin', 'wd-requests.json');
        const usersPath = path.join(__dirname, 'database', 'user', 'user-login.json');

        if (!fs.existsSync(wdPath)) {
            return res.status(404).json({ success: false, message: 'Gagal! File wd-requests.json tidak ditemukan!' });
        }

        if (!fs.existsSync(usersPath)) {
            return res.status(404).json({ success: false, message: 'Gagal! File user-login.json tidak ditemukan!' });
        }

        let wdData = JSON.parse(fs.readFileSync(wdPath, 'utf8') || '[]');
        let usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8') || '[]');

        const wdIndex = wdData.findIndex(x => String(x.wdId) === String(wdId));
        if (wdIndex === -1) {
            return res.status(404).json({ success: false, message: 'ID Penarikan tidak ditemukan!' });
        }

        const currentStatus = String(wdData[wdIndex].status).toUpperCase();
        if (currentStatus !== 'PENDING') {
            return res.status(400).json({ success: false, message: 'Permintaan ini sudah diproses sebelumnya!' });
        }

        const applicantUsername = wdData[wdIndex].username;
        const nominalWd = parseInt(wdData[wdIndex].nominal || 0);

        const userIndex = usersData.findIndex(u => String(u.username).toLowerCase() === String(applicantUsername).toLowerCase());
        if (userIndex === -1) {
            return res.status(404).json({ success: false, message: 'Akun admin pemohon tidak ditemukan di database!' });
        }

        if (action === 'approve') {
            wdData[wdIndex].status = 'SUCCESS';
            wdData[wdIndex].keterangan = 'Penarikan berhasil ditransfer oleh owner';
        } else if (action === 'reject') {
            let currentSaldo = parseInt(usersData[userIndex].saldo || 0);
            usersData[userIndex].saldo = currentSaldo + nominalWd;
            wdData[wdIndex].status = 'REJECTED';
            wdData[wdIndex].keterangan = 'Penarikan ditolak oleh owner, saldo dikembalikan';
        } else {
            return res.status(400).json({ success: false, message: 'Aksi tidak valid!' });
        }

        fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 4), 'utf8');
        fs.writeFileSync(wdPath, JSON.stringify(wdData, null, 4), 'utf8');

        res.json({ success: true, message: 'Proses verifikasi berhasil diperbarui!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan internal pada server' });
    }
});

app.post('/api/owner/product/add', (req, res) => {
    if (!req.session || !req.session.user || req.session.user.role !== 'owner') {
        return res.status(403).json({ success: false, message: 'Akses ditolak, khusus Owner!' });
    }

    const { category, productName, imageUrl, items } = req.body;

    if (!category || !productName || !imageUrl || !items || !Array.isArray(items)) {
        return res.status(400).json({ success: false, message: 'Data format tidak valid!' });
    }

    const productsPath = path.join(__dirname, 'database', 'admin', 'products.json');

    try {
        if (!fs.existsSync(path.dirname(productsPath))) {
            fs.mkdirSync(path.dirname(productsPath), { recursive: true });
        }

        let dbProducts = [];
        if (fs.existsSync(productsPath)) {
            dbProducts = JSON.parse(fs.readFileSync(productsPath, 'utf8') || '[]');
        }

        const generatedId = 'PRD-' + Math.floor(100000 + Math.random() * 900000);

        const newProduct = {
            category,
            productId: generatedId,
            productName,
            imageUrl,
            isVariant: items.length > 1,
            items: items.map(item => ({
                subName: item.subName,
                harga: parseInt(item.harga || 0),
                stok: parseInt(item.stok || 0),
                deskripsi: item.deskripsi || '',
                deskripsiExt: item.deskripsiExt || '',
                email: item.email || '',
                pw: item.pw || '',
                linkApk: item.linkApk || '',
                urlProduk: item.urlProduk || '',
                a2f: item.a2f || 'OFF',
                dataRahasia: item.dataRahasia || ''
            })),
            merchantName: "PRODUK BY OWNER",
            uploadedBy: "owner",
            createdAt: new Date().toISOString()
        };

        dbProducts.push(newProduct);
        fs.writeFileSync(productsPath, JSON.stringify(dbProducts, null, 4), 'utf8');

        res.json({ success: true, message: 'Produk berhasil ditambahkan!', productId: generatedId });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menyimpan ke database server.' });
    }
});

app.delete('/api/owner/product/delete/:productId', (req, res) => {
    if (!req.session || !req.session.user || req.session.user.role !== 'owner') {
        return res.status(403).json({ success: false, message: 'Akses ditolak, khusus Owner!' });
    }

    const { productId } = req.params;
    const productsPath = path.join(__dirname, 'database', 'admin', 'products.json');

    try {
        if (!fs.existsSync(productsPath)) {
            return res.status(444).json({ success: false, message: 'Database produk tidak ditemukan!' });
        }

        const fileData = fs.readFileSync(productsPath, 'utf8');
        let dbProducts = JSON.parse(fileData || '[]');

        const productIndex = dbProducts.findIndex(p => String(p.productId) === String(productId) || String(p.id) === String(productId));

        if (productIndex === -1) {
            return res.status(444).json({ success: false, message: 'Produk tidak ditemukan!' });
        }

        dbProducts.splice(productIndex, 1);
        fs.writeFileSync(productsPath, JSON.stringify(dbProducts, null, 4), 'utf8');

        res.json({ 
            success: true, 
            message: 'Produk berhasil dihapus dari database!' 
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal memproses penghapusan di server.' });
    }
});

app.put('/api/owner/product/update/:productId', (req, res) => {
    if (!req.session || !req.session.user || req.session.user.role !== 'owner') {
        return res.status(403).json({ success: false, message: 'Akses ditolak, khusus Owner!' });
    }

    const { productId } = req.params;
    const { name, category, price, imageUrl, deskripsi, deskripsiExt } = req.body;
    const productsPath = path.join(__dirname, 'database', 'admin', 'products.json');

    try {
        if (!fs.existsSync(productsPath)) {
            return res.status(444).json({ success: false, message: 'Database tidak ditemukan!' });
        }

        let dbProducts = JSON.parse(fs.readFileSync(productsPath, 'utf8') || '[]');
        const productIndex = dbProducts.findIndex(p => String(p.productId) === String(productId) || String(p.id) === String(productId));

        if (productIndex === -1) {
            return res.status(444).json({ success: false, message: 'Produk gagal ditemukan!' });
        }

        dbProducts[productIndex].name = name;
        dbProducts[productIndex].productName = name;
        dbProducts[productIndex].category = category;
        dbProducts[productIndex].price = price;
        dbProducts[productIndex].imageUrl = imageUrl;
        dbProducts[productIndex].deskripsi = deskripsi;
        dbProducts[productIndex].deskripsiExt = deskripsiExt;

        fs.writeFileSync(productsPath, JSON.stringify(dbProducts, null, 4), 'utf8');
        res.json({ success: true, message: 'Data produk master berhasil diupdate!' });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal memproses pembaruan di server.' });
    }
});

app.get('/api/owner/my-products', (req, res) => {
    const adminProductsPath = path.join(__dirname, 'database', 'admin', 'products.json');
    
    try {
        let allProducts = [];

        if (fs.existsSync(adminProductsPath)) {
            const adminData = fs.readFileSync(adminProductsPath, 'utf8');
            allProducts = JSON.parse(adminData || '[]');
        }

        const ownerOnlyProducts = allProducts.filter(p => p.merchantName === "PRODUK BY OWNER");

        res.json({
            success: true,
            data: ownerOnlyProducts
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mengambil data produk owner.' });
    }
});

app.get('/api/admin/riwayat-global-pembelian', (req, res) => {
    if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Akses ditolak!' });
    }

    try {
        const pembelianPath = path.join(__dirname, 'database', 'user', 'pembelian.json');
        const productsPath = path.join(__dirname, 'database', 'admin', 'products.json');

        if (!fs.existsSync(pembelianPath)) {
            return res.json({ success: true, data: [] });
        }

        const historyData = JSON.parse(fs.readFileSync(pembelianPath, 'utf8') || '[]');
        let productsData = [];

        if (fs.existsSync(productsPath)) {
            productsData = JSON.parse(fs.readFileSync(productsPath, 'utf8') || '[]');
        }

        const combinedData = historyData.map(order => {
            const productMatch = productsData.find(p => String(p.productId) === String(order.productId));
            
            let details = {};
            if (productMatch && productMatch.items && Array.isArray(productMatch.items)) {
                const variantMatch = productMatch.items.find(v => String(v.subName).toLowerCase() === String(order.subName).toLowerCase());
                if (variantMatch) {
                    details = {
                        email: variantMatch.email || '',
                        pw: variantMatch.pw || '',
                        linkApk: variantMatch.linkApk || '',
                        urlProduk: variantMatch.urlProduk || '',
                        a2f: variantMatch.a2f || 'OFF',
                        deskripsi: variantMatch.deskripsi || '',
                        deskripsiExt: variantMatch.deskripsiExt || ''
                    };
                }
            }

            return {
                ...order,
                imageUrl: productMatch ? productMatch.imageUrl : 'https://placehold.co/100x100/11121a/white?text=PRODUK',
                category: order.category || (productMatch ? productMatch.category : 'DIGITAL'),
                ...details
            };
        });

        res.json({ success: true, data: combinedData });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal memproses data' });
    }
});

app.get('/api/owner/broadcast', (req, res) => {
    try {
        const broadcastPath = path.join(__dirname, 'database', 'admin', 'broadcast.json');
        
        if (!fs.existsSync(broadcastPath)) {
            return res.json({
                success: true,
                data: {
                    title: "PENGUMUMAN",
                    message: "Belum ada pengumuman terbaru.",
                    type: "info",
                    status: "nonaktif"
                }
            });
        }

        const rawData = fs.readFileSync(broadcastPath, 'utf8');
        const broadcastData = JSON.parse(rawData || '{}');

        res.json({
            success: true,
            data: broadcastData
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: "Gagal memuat data broadcast" 
        });
    }
});

app.post('/api/owner/broadcast/save', (req, res) => {
    if (!req.session || !req.session.user || req.session.user.role !== 'owner') {
        return res.status(403).json({ success: false, message: 'Akses ditolak!' });
    }

    const { title, message, type, status } = req.body;
    const bcPath = path.join(__dirname, 'database', 'admin', 'broadcast.json');

    try {
        if (!fs.existsSync(path.dirname(bcPath))) {
            fs.mkdirSync(path.dirname(bcPath), { recursive: true });
        }

        if (fs.existsSync(bcPath)) {
            const currentBc = JSON.parse(fs.readFileSync(bcPath, 'utf8') || '{}');
            if (currentBc.status === 'aktif' && status !== 'nonaktif') {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Fitur terkunci! Nonaktifkan status broadcast yang sedang berjalan terlebih dahulu sebelum membuat baru.' 
                });
            }
        }

        const newBc = {
            title: title || '',
            message: message || '',
            type: type || 'info',
            status: status || 'aktif',
            updatedAt: new Date().toISOString()
        };

        fs.writeFileSync(bcPath, JSON.stringify(newBc, null, 4), 'utf8');
        res.json({ success: true, message: 'Broadcast berhasil diperbarui!' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menyimpan data broadcast.' });
    }
});

app.post('/api/owner/broadcast/delete', (req, res) => {
    if (!req.session || !req.session.user || req.session.user.role !== 'owner') {
        return res.status(403).json({ success: false, message: 'Akses ditolak!' });
    }

    try {
        const bcPath = path.join(__dirname, 'database', 'admin', 'broadcast.json');
        
        if (fs.existsSync(bcPath)) {
            const clearedBc = {
                title: "",
                message: "",
                type: "info",
                status: "nonaktif",
                updatedAt: new Date().toISOString()
            };

            fs.writeFileSync(bcPath, JSON.stringify(clearedBc, null, 4), 'utf8');
            res.json({ success: true, message: 'Teks broadcast berhasil dibersihkan!' });
        } else {
            res.json({ success: false, message: 'Berkas broadcast tidak ditemukan!' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Gagal menghapus data broadcast.' });
    }
});

app.post('/api/lelang/upload', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ success: false, message: 'Sesi habis, silakan login kembali!' });
    }

    const { namaProduk, deskripsi, hargaAwal, hargaTinggi, durasiHari, linkProduk, foto } = req.body;
    if (!namaProduk || !deskripsi || hargaAwal === undefined || !hargaTinggi || !durasiHari || !linkProduk || !foto) {
        return res.status(400).json({ success: false, message: 'Data formulir tidak lengkap!' });
    }

    try {
        const lelangDir = path.join(__dirname, 'database', 'lelang');
        const lelangPath = path.join(lelangDir, 'items.json');

        if (!fs.existsSync(lelangDir)) {
            fs.mkdirSync(lelangDir, { recursive: true });
        }

        let lelangData = [];
        if (fs.existsSync(lelangPath)) {
            lelangData = JSON.parse(fs.readFileSync(lelangPath, 'utf8') || '[]');
        }

        const waktuMulai = new Date();
        const waktuSelesai = new Date();
        waktuSelesai.setDate(waktuMulai.getDate() + parseInt(durasiHari));

        const newLelangItem = {
            lelangId: "LLG" + Date.now() + Math.floor(1000 + Math.random() * 9000),
            uploader: req.session.user.username,
            namaProduk: namaProduk,
            deskripsi: deskripsi,
            hargaAwal: parseInt(hargaAwal),
            hargaTinggi: parseInt(hargaTinggi),
            hargaSekarang: parseInt(hargaAwal),
            durasiHari: parseInt(durasiHari),
            linkProduk: linkProduk,
            foto: foto,
            status: "AKTIF",
            tanggalMulai: waktuMulai.toLocaleString('id-ID'),
            tanggalSelesai: waktuSelesai.toLocaleString('id-ID'),
            tertinggiUsername: "-",
            bids: []
        };

        lelangData.push(newLelangItem);
        fs.writeFileSync(lelangPath, JSON.stringify(lelangData, null, 4), 'utf8');

        res.json({ success: true, message: 'Produk lelang berhasil diterbitkan!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan internal pada server' });
    }
});

app.get('/api/lelang/list', (req, res) => {
    try {
        const lelangPath = path.join(__dirname, 'database', 'lelang', 'items.json');
        if (!fs.existsSync(lelangPath)) return res.json({ success: true, data: [] });
        
        let data = JSON.parse(fs.readFileSync(lelangPath, 'utf8') || '[]');
        let aktifOnly = data.filter(item => item.status === 'AKTIF');
        res.json({ success: true, data: aktifOnly });
    } catch (e) {
        res.status(500).json({ success: false, data: [] });
    }
});

app.get('/api/lelang/detail/:id', (req, res) => {
    try {
        const lelangPath = path.join(__dirname, 'database', 'lelang', 'items.json');
        let data = JSON.parse(fs.readFileSync(lelangPath, 'utf8') || '[]');
        let target = data.find(x => x.lelangId === req.params.id);
        if (!target) return res.status(404).json({ success: false, message: 'Tidak ada' });
        res.json({ success: true, data: target });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/lelang/bid', (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ success: false, message: 'Sesi habis!' });
    const { lelangId, nominal } = req.body;
    
    try {
        const lelangPath = path.join(__dirname, 'database', 'lelang', 'items.json');
        let lelangData = JSON.parse(fs.readFileSync(lelangPath, 'utf8') || '[]');
        let idx = lelangData.findIndex(x => x.lelangId === lelangId);
        
        if (idx === -1 || lelangData[idx].status !== 'AKTIF') {
            return res.json({ success: false, message: 'Barang tidak tersedia atau lelang sudah ditutup!' });
        }

        if (lelangData[idx].uploader === req.session.user.username) {
            return res.json({ success: false, message: 'Gagal! Anda tidak bisa melakukan bid pada produk lelang milik Anda sendiri!' });
        }

        if (parseInt(nominal) <= lelangData[idx].hargaSekarang) {
            return res.json({ success: false, message: 'Gagal! Bid kamu harus lebih tinggi dari harga penawaran saat ini!' });
        }

        lelangData[idx].hargaSekarang = parseInt(nominal);
        lelangData[idx].tertinggiUsername = req.session.user.username;
        lelangData[idx].bids.push({
            username: req.session.user.username,
            nominal: parseInt(nominal),
            waktu: new Date().toLocaleString('id-ID')
        });

        fs.writeFileSync(lelangPath, JSON.stringify(lelangData, null, 4), 'utf8');
        res.json({ success: true, message: 'Sukses! Penawaran harga kamu berhasil ditempatkan.' });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Gagal memproses bid' });
    }
});

app.post('/api/lelang/buynow', (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ success: false, message: 'Sesi habis!' });
    const { lelangId } = req.body;

    try {
        const lelangPath = path.join(__dirname, 'database', 'lelang', 'items.json');
        const usersPath = path.join(__dirname, 'database', 'user', 'user-login.json');
        const orderPath = path.join(__dirname, 'database', 'order', 'history.json');

        let lelangData = JSON.parse(fs.readFileSync(lelangPath, 'utf8') || '[]');
        let usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8') || '[]');

        let lIdx = lelangData.findIndex(x => x.lelangId === lelangId);
        if (lIdx === -1 || lelangData[lIdx].status !== 'AKTIF') {
            return res.json({ success: false, message: 'Produk lelang sudah tidak aktif atau terjual!' });
        }

        if (lelangData[lIdx].uploader === req.session.user.username) {
            return res.json({ success: false, message: 'Gagal! Anda tidak bisa membeli produk lelang milik Anda sendiri!' });
        }

        const hargaBeliInstan = lelangData[lIdx].hargaTinggi;
        const buyerUsername = req.session.user.username;
        const uploaderUsername = lelangData[lIdx].uploader;

        let uIdx = usersData.findIndex(u => String(u.username).toLowerCase() === String(buyerUsername).toLowerCase());
        if (uIdx === -1) return res.json({ success: false, message: 'User tidak valid!' });
        
        let userSaldo = parseInt(usersData[uIdx].saldo || 0);
        if (userSaldo < hargaBeliInstan) {
            return res.json({ success: false, message: 'Gagal! Saldo Anda kurang untuk melakukan pembelian instan!' });
        }

        usersData[uIdx].saldo = userSaldo - hargaBeliInstan;
        req.session.user.saldo = usersData[uIdx].saldo;

        let upIdx = usersData.findIndex(u => String(u.username).toLowerCase() === String(uploaderUsername).toLowerCase());
        if (upIdx !== -1) {
            let potongan = hargaBeliInstan * 0.10;
            let saldoBersihUploader = hargaBeliInstan - potongan;
            usersData[upIdx].saldo = parseInt(usersData[upIdx].saldo || 0) + saldoBersihUploader;
        }

        const orderDir = path.dirname(orderPath);
        if (!fs.existsSync(orderDir)) {
            fs.mkdirSync(orderDir, { recursive: true });
        }

        let orderData = [];
        if (fs.existsSync(orderPath)) {
            orderData = JSON.parse(fs.readFileSync(orderPath, 'utf8') || '[]');
        }

        orderData.push({
            invoiceId: "INV-LLG" + Date.now(),
            username: buyerUsername,
            lelangId: lelangId,
            productName: "[LELANG INSTAN] " + lelangData[lIdx].namaProduk,
            totalGrossPrice: hargaBeliInstan,
            linkAkses: lelangData[lIdx].linkProduk,
            foto: lelangData[lIdx].foto,
            uploader: uploaderUsername,
            date: new Date().toLocaleString('id-ID')
        });

        lelangData.splice(lIdx, 1);

        fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 4), 'utf8');
        fs.writeFileSync(lelangPath, JSON.stringify(lelangData, null, 4), 'utf8');
        fs.writeFileSync(orderPath, JSON.stringify(orderData, null, 4), 'utf8');

        res.json({ success: true, message: 'Selamat! Pembelian instan sukses. Cek riwayat pembelian produk Anda!' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Error internal server buy now' });
    }
});

app.get('/api/lelang/history', (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ success: false, message: 'Sesi habis!' });
    
    try {
        const orderPath = path.join(__dirname, 'database', 'order', 'history.json');
        if (!fs.existsSync(orderPath)) return res.json({ success: true, data: [] });
        
        let orderData = JSON.parse(fs.readFileSync(orderPath, 'utf8') || '[]');
        
        let userHistory = orderData.filter(item => 
            String(item.username).toLowerCase() === String(req.session.user.username).toLowerCase() && 
            String(item.invoiceId).startsWith('INV-LLG')
        );
        
        res.json({ success: true, data: userHistory });
    } catch (e) {
        res.status(500).json({ success: false, data: [] });
    }
});

app.get('/api/admin/list-po-orders', (req, res) => {
    if (!req.session || !req.session.user || (req.session.user.role !== 'admin' && req.session.user.role !== 'owner')) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    try {
        const orderPath = path.join(__dirname, 'database', 'user', 'pembelian.json');
        
        if (!fs.existsSync(orderPath)) {
            return res.json({ success: true, data: [] });
        }
        
        const orders = JSON.parse(fs.readFileSync(orderPath, 'utf8') || '[]');
        const poOrders = orders.filter(order => order.invoiceId && String(order.invoiceId).startsWith('INV-PO'));
        
        res.json({ success: true, data: poOrders });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.post('/api/admin/product-po/save', (req, res) => {
    if (!req.session || !req.session.user || (req.session.user.role !== 'admin' && req.session.user.role !== 'owner')) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    try {
        const payloadData = req.body;
        const dir = path.dirname(DB_PO_PATH);
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        let fileData = [];
        if (fs.existsSync(DB_PO_PATH)) {
            const rawData = fs.readFileSync(DB_PO_PATH, 'utf8');
            fileData = rawData ? JSON.parse(rawData) : [];
        }
        payloadData.createdBy = req.session.user.username;
        payloadData.createdAt = new Date().toISOString();
        fileData.push(payloadData);
        fs.writeFileSync(DB_PO_PATH, JSON.stringify(fileData, null, 2), 'utf8');
        res.json({ success: true, message: 'data pre-order berhasil disimpan' });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.get('/api/user/products-po', (req, res) => {
    try {
        if (!fs.existsSync(DB_PO_PATH)) {
            return res.json({ success: true, data: [] });
        }
        const products = JSON.parse(fs.readFileSync(DB_PO_PATH, 'utf8'));
        res.json({ success: true, data: products });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.post('/api/user/order-po', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ success: false, message: 'Silahkan login terlebih dahulu!' });
    }

    const usernameSession = req.session.user.username;
    const { productId } = req.body;

    if (!productId) {
        return res.status(400).json({ success: false, message: 'ID produk tidak valid.' });
    }

    try {
        if (!fs.existsSync(DB_PO_PATH)) {
            return res.json({ success: false, message: 'data produk tidak ditemukan' });
        }

        let products = JSON.parse(fs.readFileSync(DB_PO_PATH, 'utf8') || '[]');
        const productIndex = products.findIndex(p => p.productId === productId);

        if (productIndex === -1) {
            return res.json({ success: false, message: 'produk tidak ditemukan' });
        }

        if (products[productIndex].stokKuota <= 0) {
            return res.json({ success: false, message: 'maaf kuota slot po sudah habis' });
        }

        const USER_DB_PATH = path.join(__dirname, 'database', 'user', 'user-login.json');
        if (!fs.existsSync(USER_DB_PATH)) {
            return res.json({ success: false, message: 'database user tidak ditemukan' });
        }

        let users = JSON.parse(fs.readFileSync(USER_DB_PATH, 'utf8') || '[]');
        const userIndex = users.findIndex(u => u.username === usernameSession);

        if (userIndex === -1) {
            return res.json({ success: false, message: 'data user tidak ditemukan' });
        }

        const hargaProduk = parseInt(products[productIndex].harga || 0);
        const saldoUser = parseInt(users[userIndex].saldo || 0);

        if (saldoUser < hargaProduk) {
            return res.json({ success: false, message: 'gagal order! saldo kamu tidak mencukupi.' });
        }

        users[userIndex].saldo = saldoUser - hargaProduk;
        req.session.user.saldo = users[userIndex].saldo;
        fs.writeFileSync(USER_DB_PATH, JSON.stringify(users, null, 4), 'utf8');

        products[productIndex].stokKuota -= 1;
        fs.writeFileSync(DB_PO_PATH, JSON.stringify(products, null, 4), 'utf8');

        const orderDir = path.dirname(ORDER_PO_PATH);
        if (!fs.existsSync(orderDir)) {
            fs.mkdirSync(orderDir, { recursive: true });
        }

        let orderData = [];
        if (fs.existsSync(ORDER_PO_PATH)) {
            orderData = JSON.parse(fs.readFileSync(ORDER_PO_PATH, 'utf8') || '[]');
        }

        orderData.push({
            invoiceId: "INV-PO" + Date.now(),
            username: usernameSession,
            email: users[userIndex].email,
            productId: productId,
            productName: products[productIndex].productName,
            harga: hargaProduk,
            status: "Proses PO",
            date: new Date().toLocaleString('id-ID')
        });

        fs.writeFileSync(ORDER_PO_PATH, JSON.stringify(orderData, null, 4), 'utf8');

        const mailOptions = {
            from: '"ErozeApps PO" <hexaelitemarket@gmail.com>',
            to: users[userIndex].email,
            subject: 'Detail Pembelian Produk Pre-Order',
            html: `
                <div style="font-family: sans-serif; padding: 20px; background-color: #0f1015; color: #ffffff;">
                    <h2 style="color: #dc2626;">Order Sukses Berhasil!</h2>
                    <p>Terima kasih telah melakukan pemesanan produk pre-order di platform kami.</p>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #212330; color: #a3a3a3;">Nama Produk</td>
                            <td style="padding: 8px; border-bottom: 1px solid #212330; font-weight: bold;">${products[productIndex].productName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #212330; color: #a3a3a3;">Status</td>
                            <td style="padding: 8px; border-bottom: 1px solid #212330; color: #10b981; font-weight: bold;">Diproses</td>
                        </tr>
                    </table>
                </div>
            `
        };

        if (typeof poTransporter !== 'undefined') {
            poTransporter.sendMail(mailOptions, (error, info) => {
                if (error) console.error(error);
            });
        }

        res.json({ 
            success: true, 
            message: 'order berhasil silahkan cek email yang terdaftar di website ini, untuk melihat produk yang telah di kirim lewat email' 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Gagal memproses order di server.' });
    }
});

app.post('/api/admin/send-data-po', (req, res) => {
    if (!req.session || !req.session.user || (req.session.user.role !== 'admin' && req.session.user.role !== 'owner')) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { targetEmail, namaProduk, invoiceId, dataAkun } = req.body;

    if (!targetEmail || !namaProduk || !dataAkun) {
        return res.status(400).json({ success: false, message: 'data formulir tidak lengkap!' });
    }

    try {
        const mailOptions = {
            from: '"Hexa Market" <hexaelitemarket@gmail.com>',
            to: targetEmail,
            subject: `Data Pesanan Pre-Order: ${namaProduk.toUpperCase()}`,
            html: `
                <div style="font-family: sans-serif; padding: 25px; background-color: #0f1015; color: #f3f4f6; max-width: 600px; border-radius: 16px; border: 1px solid #27272a;">
                    <div style="border-b: 1px solid #27272a; padding-bottom: 15px; margin-bottom: 20px;">
                        <h2 style="color: #f97316; margin: 0; font-size: 18px; letter-spacing: 1px;">EROZEAPPS PRE-ORDER SUKSES</h2>
                        <p style="color: #71717a; margin: 5px 0 0 0; font-size: 11px;">pesanan pre-order kamu telah selesai dikerjakan</p>
                    </div>
                    
                    <p style="font-size: 13px; color: #e4e4e7; line-height: 1.6;">halo pelanggan setia, berikut adalah data produk/kredensial akun untuk item pesanan pre-order kamu yang sudah selesai diproses oleh admin:</p>
                    
                    <div style="background-color: #14151f; border: 1px solid #27272a; padding: 15px; border-radius: 12px; margin: 20px 0;">
                        <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                            <tr>
                                <td style="color: #71717a; padding: 6px 0; width: 120px;">nama produk :</td>
                                <td style="color: #ffffff; font-weight: bold; padding: 6px 0;">${namaProduk.toLowerCase()}</td>
                            </tr>
                            <tr>
                                <td style="color: #71717a; padding: 6px 0;">id invoice :</td>
                                <td style="color: #f97316; font-family: monospace; font-weight: bold; padding: 6px 0;">${invoiceId.toUpperCase()}</td>
                            </tr>
                            <tr>
                                <td style="color: #71717a; padding: 6px 0;">tanggal kirim :</td>
                                <td style="color: #a1a1aa; padding: 6px 0;">${new Date().toLocaleString('id-ID')}</td>
                            </tr>
                        </table>
                    </div>

                    <div style="margin-top: 20px;">
                        <label style="font-size: 10px; font-weight: bold; color: #71717a; tracking: 1px; display: block; margin-bottom: 8px;">DATA AKSES PRODUK :</label>
                        <div style="background-color: #000000; border: 1px solid #27272a; padding: 15px; border-radius: 12px; font-family: monospace; font-size: 12px; color: #34d399; white-space: pre-wrap; word-break: break-all; line-height: 1.5;">${dataAkun}</div>
                    </div>

                    <p style="font-size: 11px; color: #52525b; margin-top: 30px; text-align: center; border-t: 1px solid #18181b; padding-top: 15px;">terima kasih telah berbelanja di store kami. jangan ragu untuk order kembali!</p>
                </div>
            `
        };

        poTransporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ success: false, message: 'gagal mengirim data lewat email!' });
            }
            res.json({ success: true, message: 'sukses! data pesanan po telah berhasil dikirim ke email user.' });
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.post('/api/auth/send-otp', (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.json({ success: false, message: 'email wajib diisi!' });
    }

    try {
        const otp = crypto.randomInt(100000, 999999).toString();
        
        tempOtpStorage[email] = {
            code: otp,
            expiresAt: Date.now() + 5 * 60 * 1000
        };

        const mailOptions = {
            from: '"Hexa Elite Market" <hexaelitemarket@gmail.com>',
            to: email,
            subject: 'Kode OTP Verifikasi Pendaftaran Akun',
            html: `
                <div style="font-family: sans-serif; padding: 25px; background-color: #0f1015; color: #f3f4f6; max-width: 450px; border-radius: 16px; border: 1px solid #27272a; margin: 0 auto;">
                    <div style="border-bottom: 1px solid #27272a; padding-bottom: 15px; margin-bottom: 20px; text-align: center;">
                        <h2 style="color: #dc2626; margin: 0; font-size: 18px; letter-spacing: 1px;">VERIFIKASI EMAIL DAFTAR</h2>
                    </div>
                    <p style="font-size: 12px; color: #a1a1aa; line-height: 1.6; text-align: center;">berikut adalah kode otp sistem untuk mengonfirmasi bahwa alamat email yang kamu daftarkan adalah asli dan aktif:</p>
                    
                    <div style="background-color: #14151f; border: 2px dashed #dc2626; padding: 15px; border-radius: 12px; margin: 20px 0; text-align: center;">
                        <span style="font-family: monospace; font-size: 24px; font-weight: bold; color: #ffffff; letter-spacing: 6px;">${otp}</span>
                    </div>

                    <p style="font-size: 10px; color: #52525b; text-align: center;">kode ini rahasia dan akan hangus otomatis dalam 5 menit. jangan bagikan kode ini kepada siapapun termasuk tim admin.</p>
                </div>
            `
        };

        poTransporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error(error);
                return res.json({ success: false, message: 'gagal mengirim email otp, pastikan email benar!' });
            }
            res.json({ success: true, message: 'kode otp berhasil dikirim!' });
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.post('/api/auth/daftar', (req, res) => {
    const { username, password, email, nomorHp, apiKey, otpCode } = req.body;

    if (!username || !password || !email || !otpCode) {
        return res.json({ success: false, message: 'data pendaftaran tidak lengkap!' });
    }

    try {
        const otpData = tempOtpStorage[email];

        if (!otpData) {
            return res.json({ success: false, message: 'silakan minta kode otp baru terlebih dahulu!' });
        }

        if (Date.now() > otpData.expiresAt) {
            delete tempOtpStorage[email];
            return res.json({ success: false, message: 'kode otp sudah kedaluwarsa (hangus)!' });
        }

        if (otpData.code !== otpCode.trim()) {
            return res.json({ success: false, message: 'kode otp yang kamu masukkan salah/palsu!' });
        }

        delete tempOtpStorage[email];

        const USER_DB_PATH = path.join(__dirname, 'database', 'user', 'user-login.json');
        let users = [];

        if (fs.existsSync(USER_DB_PATH)) {
            users = JSON.parse(fs.readFileSync(USER_DB_PATH, 'utf8') || '[]');
        }

        if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            return res.json({ success: false, message: 'username tersebut sudah terdaftar!' });
        }

        if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
            return res.json({ success: false, message: 'email tersebut sudah terpakai!' });
        }

        users.push({
            username,
            password,
            email,
            nomorHp,
            apiKey,
            role: "user",
            saldo: 0,
            createdAt: new Date().toISOString()
        });

        fs.writeFileSync(USER_DB_PATH, JSON.stringify(users, null, 4), 'utf8');
        res.json({ success: true, message: 'pendaftaran sukses! akun kamu berhasil dibuat.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'gagal menyimpan akun ke database.' });
    }
});

// INI BUAT API
// USER ONLY

app.get('/api/hexa/listkategori', (req, res) => {
    const { apikey } = req.query;
    if (!apikey) {
        return res.status(401).json({ success: false, message: 'API Key wajib disertakan pada parameter URL!' });
    }

    try {
        const users = JSON.parse(fs.readFileSync(USER_DB_PATH, 'utf8') || '[]');
        const validUser = users.find(u => u.apiKey === apikey);
        
        if (!validUser) {
            return res.status(403).json({ success: false, message: 'API Key tidak valid!' });
        }

        if (!fs.existsSync(PRODUCTS_DB_PATH)) {
            return res.json({ success: true, data: [] });
        }

        const fileData = fs.readFileSync(PRODUCTS_DB_PATH, 'utf8');
        const dbProducts = JSON.parse(fileData || '[]');

        const categories = dbProducts
            .map(p => p.category ? p.category.toUpperCase().trim() : "LAINNYA")
            .filter((value, index, self) => self.indexOf(value) === index);

        res.json({ 
            success: true, 
            data: categories 
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal memproses permintaan kategori' });
    }
});

app.get('/api/hexa/products', (req, res) => {
    const { apikey } = req.query;
    if (!apikey) return res.status(401).json({ success: false, message: 'API Key wajib disertakan pada parameter URL!' });

    try {
        const users = JSON.parse(fs.readFileSync(USER_DB_PATH, 'utf8') || '[]');
        const validUser = users.find(u => u.apiKey === apikey);
        
        if (!validUser) return res.status(403).json({ success: false, message: 'API Key tidak valid!' });

        const fileData = fs.readFileSync(PRODUCTS_DB_PATH, 'utf8');
        const dbProducts = JSON.parse(fileData || '[]');
        res.json({ success: true, data: dbProducts });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal memproses permintaan' });
    }
});

app.get('/api/hexa/products/:id', (req, res) => {
    const { apikey } = req.query;
    if (!apikey) return res.status(401).json({ success: false, message: 'API Key wajib disertakan pada parameter URL!' });

    try {
        const users = JSON.parse(fs.readFileSync(USER_DB_PATH, 'utf8') || '[]');
        const validUser = users.find(u => u.apiKey === apikey);
        
        if (!validUser) return res.status(403).json({ success: false, message: 'API Key tidak valid!' });

        const fileData = fs.readFileSync(PRODUCTS_DB_PATH, 'utf8');
        const dbProducts = JSON.parse(fileData || '[]');
        
        const targetProduct = dbProducts.find(p => 
            String(p.productId) === String(req.params.id) || 
            String(p.id) === String(req.params.id)
        );
        
        if (targetProduct) {
            res.json({ success: true, data: targetProduct });
        } else {
            res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal memproses permintaan' });
    }
});

app.get('/api/hexa/products-by-category', (req, res) => {
    const { apikey, category } = req.query;
    if (!apikey) {
        return res.status(401).json({ success: false, message: 'API Key wajib disertakan pada parameter URL!' });
    }
    if (!category) {
        return res.status(400).json({ success: false, message: 'Parameter kategori wajib disertakan!' });
    }

    try {
        const users = JSON.parse(fs.readFileSync(USER_DB_PATH, 'utf8') || '[]');
        const validUser = users.find(u => u.apiKey === apikey);
        
        if (!validUser) {
            return res.status(403).json({ success: false, message: 'API Key tidak valid!' });
        }

        if (!fs.existsSync(PRODUCTS_DB_PATH)) {
            return res.json({ success: true, data: [] });
        }

        const fileData = fs.readFileSync(PRODUCTS_DB_PATH, 'utf8');
        const dbProducts = JSON.parse(fileData || '[]');

        const filteredProducts = dbProducts.filter(p => 
            p.category && p.category.toLowerCase().trim() === category.toLowerCase().trim()
        );

        const safeProducts = filteredProducts.map(product => {
            const safeItems = (product.items || []).map(item => {
                return {
                    subName: item.subName,
                    harga: item.harga,
                    stok: item.stok,
                    deskripsi: item.deskripsi
                };
            });

            return {
                productId: product.productId || product.id,
                productName: product.productName,
                category: product.category,
                merchantName: product.merchantName,
                imageUrl: product.imageUrl || product.image || '',
                items: safeItems
            };
        });

        res.json({ 
            success: true, 
            data: safeProducts 
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal memproses filter kategori' });
    }
});

app.get('/api/hexa/profile', (req, res) => {
    const { apikey } = req.query;
    if (!apikey) {
        return res.status(401).json({ success: false, message: 'API Key wajib disertakan pada parameter URL!' });
    }

    try {
        const users = JSON.parse(fs.readFileSync(USER_DB_PATH, 'utf8') || '[]');
        const validUser = users.find(u => u.apiKey === apikey);
        
        if (!validUser) {
            return res.status(403).json({ success: false, message: 'API Key tidak valid!' });
        }

        res.json({
            success: true,
            data: {
                username: validUser.username,
                email: validUser.email,
                nomorHp: validUser.nomorHp,
                role: validUser.role,
                saldo: validUser.saldo || 0
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mengambil data profil' });
    }
});

app.get('/api/hexa/order', (req, res) => {
    const { apikey, category, productId, subName, quantity } = req.query;

    if (!apikey) {
        return res.status(401).json({ success: false, message: 'API Key wajib disertakan pada parameter URL!' });
    }
    if (!category || !productId || !subName) {
        return res.status(400).json({ success: false, message: 'Parameter category, productId, dan subName wajib diisi!' });
    }

    const buyQty = parseInt(quantity || 1);
    if (buyQty < 1 || buyQty > 10) {
        return res.status(400).json({ success: false, message: 'Jumlah pembelian tidak valid! Minimal 1 dan Maksimal 10 item per transaksi.' });
    }

    try {
        let users = JSON.parse(fs.readFileSync(USER_DB_PATH, 'utf8') || '[]');
        const userIndex = users.findIndex(u => u.apiKey === apikey);

        if (userIndex === -1) {
            return res.status(403).json({ success: false, message: 'API Key tidak valid!' });
        }

        let products = JSON.parse(fs.readFileSync(PRODUCTS_DB_PATH, 'utf8') || '[]');
        const productIndex = products.findIndex(p => 
            (String(p.productId) === String(productId) || String(p.id) === String(productId)) && 
            p.category && p.category.toLowerCase().trim() === category.toLowerCase().trim()
        );
        
        if (productIndex === -1) {
            return res.status(404).json({ success: false, message: 'Produk tidak ditemukan atau kategori tidak cocok!' });
        }

        const variantIndex = products[productIndex].items.findIndex(item => item.subName === subName);
        if (variantIndex === -1) {
            return res.status(404).json({ success: false, message: 'Opsi varian produk tidak ditemukan!' });
        }

        const targetVariant = products[productIndex].items[variantIndex];
        const itemPrice = parseInt(targetVariant.harga || 0);
        const totalGross = itemPrice * buyQty;

        let buyerSaldo = parseInt(users[userIndex].saldo || 0);
        if (buyerSaldo < totalGross) {
            return res.status(400).json({ success: false, message: 'Saldo Anda tidak mencukupi! Silakan lakukan deposit terlebih dahulu.' });
        }

        let currentStock = parseInt(targetVariant.stok || 0);
        if (currentStock < buyQty) {
            return res.status(400).json({ success: false, message: `Gagal! Stok tidak mencukupi. Sisa stok saat ini: ${currentStock}` });
        }

        const sellerUsername = products[productIndex].uploadedBy;
        const finalRevenue = Math.round(totalGross * 0.95);

        products[productIndex].items[variantIndex].stok = currentStock - buyQty;
        fs.writeFileSync(PRODUCTS_DB_PATH, JSON.stringify(products, null, 4), 'utf8');

        users[userIndex].saldo = buyerSaldo - totalGross;
        
        const sellerIndex = users.findIndex(u => u.username === sellerUsername);
        if (sellerIndex !== -1) {
            let sellerSaldo = parseInt(users[sellerIndex].saldo || 0);
            users[sellerIndex].saldo = sellerSaldo + finalRevenue;
        }

        fs.writeFileSync(USER_DB_PATH, JSON.stringify(users, null, 2));

        const orderPayload = {
            productId: productId,
            subName: subName,
            quantity: buyQty,
            totalGrossPrice: totalGross,
            finalSellerRevenue: finalRevenue,
            invoiceId: 'INV-' + Date.now() + Math.floor(1000 + Math.random() * 9000),
            buyerUsername: users[userIndex].username,
            sellerUsername: sellerUsername,
            createdAt: new Date().toISOString()
        };

        const dirPath = path.join(__dirname, 'database', 'user');
        const filePath = path.join(dirPath, 'pembelian.json');

        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        let historyData = [];
        if (fs.existsSync(filePath)) {
            try {
                historyData = JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]');
            } catch (e) {
                historyData = [];
            }
        }

        historyData.push(orderPayload);
        fs.writeFileSync(filePath, JSON.stringify(historyData, null, 4), 'utf8');

        const dataRahasia = targetVariant.dataRahasia || targetVariant.email + ' | ' + targetVariant.pw;

        res.json({ 
            success: true, 
            message: 'Transaksi sukses terekam dan stok berhasil diperbarui.',
            dataRahasia: dataRahasia,
            invoiceId: orderPayload.invoiceId,
            totalBiaya: totalGross,
            sisaSaldo: users[userIndex].saldo
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem saat memproses transaksi.' });
    }
});

app.get('/api/hexa/deposit', async (req, res) => {
    const { apikey, amount } = req.query;

    if (!apikey) {
        return res.status(401).json({ success: false, message: 'API Key wajib disertakan!' });
    }
    if (!amount) {
        return res.status(400).json({ success: false, message: 'Parameter amount wajib diisi!' });
    }

    const depositAmount = parseInt(amount);
    if (isNaN(depositAmount) || depositAmount < 1000) {
        return res.status(400).json({ success: false, message: 'Nominal minimal Rp 1.000' });
    }

    try {
        let users = JSON.parse(fs.readFileSync(USER_DB_PATH, 'utf8') || '[]');
        const validUser = users.find(u => u.apiKey === apikey);

        if (!validUser) {
            return res.status(403).json({ success: false, message: 'API Key tidak valid!' });
        }

        const apiUrl = `https://yobasepay.net/api?action=createpayment&apikey=${config.apiKey}&amount=${depositAmount}`;
        const response = await fetch(apiUrl);
        const result = await response.json();
        
        if (result.status && result.data) {
            res.json({ success: true, data: result.data });
        } else {
            res.status(400).json({ success: false, message: 'Gagal generate QRIS dari provider' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error saat membuat pembayaran' });
    }
});

app.get('/api/hexa/depositstatus', async (req, res) => {
    const { apikey, trxid } = req.query;

    if (!apikey) {
        return res.status(401).json({ success: false, message: 'API Key wajib disertakan!' });
    }
    if (!trxid) {
        return res.status(400).json({ success: false, message: 'Parameter trxid dibutuhkan!' });
    }

    try {
        let users = JSON.parse(fs.readFileSync(USER_DB_PATH, 'utf8') || '[]');
        const userIndex = users.findIndex(u => u.apiKey === apikey);

        if (userIndex === -1) {
            return res.status(403).json({ success: false, message: 'API Key tidak valid!' });
        }

        const targetUsername = users[userIndex].username;

        const apiUrl = `https://yobasepay.net/api?action=checkstatus&apikey=${config.apiKey}&trxid=${trxid}`;
        const response = await fetch(apiUrl);
        const result = await response.json();
        
        if (result.status && result.data) {
            const currentStatus = result.data.status;
            
            if (currentStatus === 'SUCCESS') {
                let logs = JSON.parse(fs.readFileSync(DEPOSIT_LOG_PATH, 'utf8') || '[]');
                const isExist = logs.some(l => l.trx_id === trxid);

                if (!isExist) {
                    let currentSaldo = parseInt(users[userIndex].saldo || 0);
                    users[userIndex].saldo = currentSaldo + parseInt(result.data.amount);
                    fs.writeFileSync(USER_DB_PATH, JSON.stringify(users, null, 2));
                    
                    if (req.session && req.session.user && req.session.user.username === targetUsername) {
                        req.session.user.saldo = users[userIndex].saldo;
                        req.session.save();
                    }
                    
                    const newLog = {
                        username: targetUsername,
                        trx_id: trxid,
                        amount: parseInt(result.data.amount),
                        status: "SUCCESS",
                        date: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
                    };
                    logs.push(newLog);
                    fs.writeFileSync(DEPOSIT_LOG_PATH, JSON.stringify(logs, null, 2));
                }
            }
            
            res.json({ success: true, status: currentStatus, amount: result.data.amount });
        } else {
            res.status(400).json({ success: false, message: 'Gagal cek status ke provider' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error saat cek status deposit' });
    }
});

app.get('/api/hexa/history', (req, res) => {
    const { apikey } = req.query;

    if (!apikey) {
        return res.status(401).json({ success: false, message: 'API Key wajib disertakan!' });
    }

    try {
        const users = JSON.parse(fs.readFileSync(USER_DB_PATH, 'utf8') || '[]');
        const user = users.find(u => u.apiKey === apikey);

        if (!user) {
            return res.status(403).json({ success: false, message: 'API Key tidak valid!' });
        }

        const filePath = path.join(__dirname, 'database', 'user', 'pembelian.json');
        if (!fs.existsSync(filePath)) {
            return res.json({ success: true, data: [] });
        }

        const historyData = JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]');
        const userHistory = historyData.filter(h => h.buyerUsername === user.username);

        res.json({
            success: true,
            data: userHistory
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal memproses riwayat pembelian' });
    }
});


app.listen(PORT, () => {
    console.clear();
    console.log("\x1b[31m┌────────────────────────────────────────────────────────┐\x1b[0m");
    console.log(`\x1b[31m│\x1b[0m \x1b[1m\x1b[33m${config.webName.toUpperCase()}\x1b[0m \x1b[32mONLINE\x1b[0m                                     \x1b[31m│\x1b[0m`);
    console.log("\x1b[31m├────────────────────────────────────────────────────────┤\x1b[0m");
    console.log(`\x1b[31m│\x1b[0m Server berjalan di http://localhost:${PORT}             \x1b[31m│\x1b[0m`);
    console.log("\x1b[31m└────────────────────────────────────────────────────────┘\x1b[0m");
});
