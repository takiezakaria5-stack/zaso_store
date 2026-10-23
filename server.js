const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const PRODUCTS_FILE = './products.json';
const ORDERS_FILE = './orders.json';

if (!fs.existsSync(PRODUCTS_FILE)) fs.writeFileSync(PRODUCTS_FILE, JSON.stringify([]));
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, JSON.stringify([]));

const TELEGRAM_BOT_TOKEN = '8821592379:AAGCpPx4euDRYre9x2lzpHFhURz-30KXi5Q';
const TELEGRAM_CHAT_ID = '1280620386';

const MY_EMAIL = 'takiezakaria5@gmail.com'; 
const EMAIL_APP_PASSWORD = 'cidn gubw cfis qatz'; 

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: MY_EMAIL, pass: EMAIL_APP_PASSWORD }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, 'store-logo.png')
});
const uploadLogo = multer({ storage: logoStorage });

async function sendTelegramNotification(order) {
    const text = `📦 *طلب جديد في متجر ZASO!*\n\n` +
                 `• *المنتج:* ${order.product}\n` +
                 `• *الكمية:* ${order.quantity}\n` +
                 `• *السعر الإجمالي:* ${order.totalPrice} د.ج\n` +
                 `• *اسم الزبون:* ${order.customerName}\n` +
                 `• *الهاتف:* ${order.customerPhone}\n` +
                 `• *الولاية:* ${order.wilaya}\n` +
                 `• *العنوان:* ${order.address}\n` +
                 `• *التاريخ:* ${order.date}`;
    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: text, parse_mode: 'Markdown' })
        });
    } catch (err) { console.error('Telegram error:', err); }
}

async function sendEmailNotification(order) {
    try {
        await transporter.sendMail({
            from: MY_EMAIL,
            to: MY_EMAIL,
            subject: `📦 طلب جديد من ZASO Store: ${order.product}`,
            html: `<h2>طلب جديد في متجر ZASO 🧶</h2><p><b>المنتج:</b> ${order.product}</p><p><b>الكمية:</b> ${order.quantity}</p><p><b>السعر:</b> ${order.totalPrice} د.ج</p><hr><p><b>الاسم:</b> ${order.customerName}</p><p><b>الهاتف:</b> ${order.customerPhone}</p><p><b>الولاية:</b> ${order.wilaya}</p><p><b>العنوان:</b> ${order.address}</p>`
        });
    } catch (err) { console.error('Email error:', err); }
}

app.post('/api/upload-logo', uploadLogo.single('logo'), (req, res) => {
    if (req.file) res.json({ success: true, logoUrl: '/uploads/store-logo.png?' + Date.now() });
    else res.status(400).json({ success: false });
});

app.get('/api/products', (req, res) => {
    try { res.json(JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'))); } catch (e) { res.json([]); }
});

app.post('/api/products', upload.array('images', 5), (req, res) => {
    const { name, description, price } = req.body;
    const images = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
    let products = [];
    try { products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8')); } catch (e) { products = []; }
    const newProduct = { id: Date.now().toString(), name, description, price: Number(price), images };
    products.push(newProduct);
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
    res.json({ success: true, product: newProduct });
});

app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    try {
        let products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
        const initialLength = products.length;
        products = products.filter(p => p.id != id);
        
        if (products.length === initialLength && products.length > 0) {
            products.shift();
        }

        fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ success: false });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        let orders = [];
        try { orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8')); } catch (e) { orders = []; }
        
        const newOrder = {
            id: Date.now(),
            ...req.body,
            date: new Date().toLocaleString('ar-DZ')
        };

        orders.unshift(newOrder);
        fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));

        sendTelegramNotification(newOrder);
        sendEmailNotification(newOrder);

        res.json({ success: true, message: 'تم تسجيل الطلب بنجاح' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'خطأ في الخادم' });
    }
});

app.get('/api/orders', (req, res) => {
    try { res.json(JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'))); } catch (e) { res.json([]); }
});

app.delete('/api/orders/:id', (req, res) => {
    try {
        let orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
        orders = orders.filter(o => o.id != req.params.id);
        fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

