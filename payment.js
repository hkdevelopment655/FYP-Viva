import express from 'express';
import { 
  createOrder, 
  getOrders, 
  getOrderById, 
  initiatePayFastPayment, 
  verifyPayment 
} from '../controllers/paymentController.js';
import { protect } from '../middleware/authMiddleware.js'; // Agar aap auth use kar rahe hain to apna exact middleware check kar lein

const router = express.Router();

// Base routes for orders
router.route('/')
  .post(protect, createOrder)
  .get(protect, getOrders);

router.route('/:id')
  .get(protect, getOrderById);

// PayFast Payment Gateway routes
router.post('/initiate', protect, initiatePayFastPayment);
router.post('/verify', protect, verifyPayment);

export default router;
