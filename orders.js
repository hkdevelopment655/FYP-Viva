import express from 'express';
import { createOrder, getOrders, getOrderById } from '../controllers/paymentController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.post('/', protect, createOrder);
router.get('/my-orders', protect, getOrders);
router.get('/:id', protect, getOrderById);

export default router;
