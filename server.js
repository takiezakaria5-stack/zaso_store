const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'public/uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const productsFile = path.join(__dirname, 'products.json');
if (!fs.existsSync(productsFile)) {
    fs.writeFileSync(productsFile, JSON.stringify([]));
}

app.get('/api/products', (req, res) => {
    const products = JSON.parse(fs.readFileSync(productsFile));
    res.json(products);
});

app.post('/api/products', upload.array('images', 5), (req, res) => {
    const { title, price, description } = req.body;
    const images = req.files ? req.files.map(f => '/uploads/' + f.filename) : [];

    const products = JSON.parse(fs.readFileSync(productsFile));
    const newProduct = {
        id: Date.now(),
        title,
        price,
        description,
        images: images.length > 0 ? images : ['https://placehold.co/400x400/f59e0b/ffffff?text=ZASO']
    };

    products.unshift(newProduct);
    fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));

    res.json({ success: true, product: newProduct });
});

app.listen(PORT, () => {
    console.log(`ZASO Store is running on http://localhost:${PORT}`);
});
