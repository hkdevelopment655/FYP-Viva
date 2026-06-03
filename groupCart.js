import express from 'express';
import { 
  createOrder, 
  getOrders, 
  getOrderById, 
  initiatePayFastPayment, 
  verifyPayment 
} from '../controllers/paymentController.js';

const router = express.Router();

router.route('/')
  .post(createOrder)
  .get(getOrders);

router.route('/:id')
  .get(getOrderById);

// PayFast Endpoints
router.post('/initiate', initiatePayFastPayment);
router.post('/verify', verifyPayment);

export default router;
