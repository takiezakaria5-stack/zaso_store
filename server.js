const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// التأكد من وجود مجلدات التخزين تلقائياً
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const PRODUCTS_FILE = './products.json';
const ORDERS_FILE = './orders.json';

if (!fs.existsSync(PRODUCTS_FILE)) {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify([]));
}
if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify([]));
}

// 1. إعدادات بوت التلغرام
const TELEGRAM_BOT_TOKEN = '8821592379:AAGCpPx4euDRYre9x2lzpHFhURz-30KXi5Q';
const TELEGRAM_CHAT_ID = '1280620386';

// 2. إعدادات Gmail
const MY_EMAIL = 'takiezakaria5@gmail.com'; 
const EMAIL_APP_PASSWORD = 'cidn gubw cfis qatz'; 

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: MY_EMAIL,
        pass: EMAIL_APP_PASSWORD
    }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// إعداد تخزين صور المنتجات
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// إعداد تخزين الشعار (Logo)
const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, 'store-logo.png');
    }
});
const uploadLogo = multer({ storage: logoStorage });

// إرسال تنبيه التلغرام
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
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: text,
                parse_mode: 'Markdown'
            })
        });
    } catch (err) {
        console.error('Telegram error:', err);
    }
}

// إرسال إيميل عبر Gmail
async function sendEmailNotification(order) {
    const mailOptions = {
        from: MY_EMAIL,
        to: MY_EMAIL,
        subject: `📦 طلب جديد من ZASO Store: ${order.product}`,
        html: `
            <h2>طلب جديد في متجر ZASO 🧶</h2>
            <p><b>المنتج:</b> ${order.product}</p>
            <p><b>الكمية:</b> ${order.quantity}</p>
            <p><b>السعر الإجمالي:</b> ${order.totalPrice} د.ج</p>
            <hr>
            <h3>بيانات الزبون:</h3>
            <p><b>الاسم:</b> ${order.customerName}</p>
            <p><b>رقم الهاتف:</b> ${order.customerPhone}</p>
            <p><b>الولاية:</b> ${order.wilaya}</p>
            <p><b>العنوان التفصيلي:</b> ${order.address}</p>
            <p><b>التاريخ:</b> ${order.date}</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (err) {
        console.error('Email error:', err);
    }
}

// رفع شعار المتجر من الآدمن
app.post('/api/upload-logo', uploadLogo.single('logo'), (req, res) => {
    if (req.file) {
        res.json({ success: true, logoUrl: '/uploads/store-logo.png?' + Date.now() });
    } else {
        res.status(400).json({ success: false, message: 'لم يتم اختيار صورة' });
    }
});

// جلب المنتجات
app.get('/api/products', (req, res) => {
    try {
        const data = fs.readFileSync(PRODUCTS_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (e) {
        res.json([]);
    }
});

// إضافة منتج (آدمن)
app.post('/api/products', upload.array('images', 5), (req, res) => {
    const { name, description, price } = req.body;
    const images = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

    let products = [];
    try {
        products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
    } catch (e) {
        products = [];
    }

    const newProduct = {
        id: Date.now().toString(),
        name,
        description,
        price: Number(price),
        images
    };

    products.push(newProduct);
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
    res.json({ success: true, product: newProduct });
});

// حذف منتج
app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    try {
        let products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
        products = products.filter(p => p.id !== id);
        fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ success: false });
    }
});

// استقبال الطلب الجديد
app.post('/api/orders', async (req, res) => {
    const orderData = req.body;
    let orders = [];
    try {
        orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
    } catch (e) {
        orders = [];
    }

    const newOrder = {
        id: Date.now(),
        ...orderData,
        date: new Date().toLocaleString('ar-DZ')
    };

    orders.unshift(newOrder);
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));

    await sendTelegramNotification(newOrder);
    await sendEmailNotification(newOrder);

    res.json({ success: true, message: 'تم تسجيل الطلب بنجاح' });
});

// جلب الطلبات
app.get('/api/orders', (req, res) => {
    try {
        const data = fs.readFileSync(ORDERS_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (e) {
        res.json([]);
    }
});

// حذف طلب
app.delete('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    try {
        let orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
        orders = orders.filter(o => o.id != id);
        fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ success: false });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

