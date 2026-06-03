import express from 'express';
import { 
  createOrder, 
  getOrders, 
  getOrderById, 
  initiatePayFastPayment, 
  verifyPayment 
} from '../controllers/paymentController.js';

const router = express.Router();

// Base routes for orders
router.route('/')
  .post(createOrder)
  .get(getOrders);

router.route('/:id')
  .get(getOrderById);

// PayFast Payment Gateway routes
router.post('/initiate', initiatePayFastPayment);
router.post('/verify', verifyPayment);

export default router;
