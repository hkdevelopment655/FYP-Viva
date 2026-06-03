import express from 'express';
import multer from 'multer';
import { getProducts, getProduct, createProduct, updateProduct, deleteProduct, addReview, searchByAI, deleteReview, getAllReviews } from '../controllers/productController.js';
import { protect, admin } from '../middleware/auth.js';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '-'));
  }
});
const upload = multer({ storage });

const router = express.Router();
router.get('/', getProducts);
router.post('/ai-search', searchByAI);
router.get('/reviews/all', protect, admin, getAllReviews);
router.get('/:id', getProduct);
router.post('/', protect, admin, createProduct);
router.post('/upload', protect, admin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ success: true, url });
});
router.put('/:id', protect, admin, updateProduct);
router.delete('/:id', protect, admin, deleteProduct);
router.post('/:id/reviews', protect, addReview);
router.delete('/:id/reviews/:reviewId', protect, admin, deleteReview);
export default router;
