import express from 'express';
import { initiatePayment, verifyPayment, paymentCallback, initiatePayFastPayment } from '../controllers/paymentController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.post('/initiate', protect, initiatePayment);
router.post('/verify', protect, verifyPayment);
router.post('/callback', paymentCallback);
router.post('/payfast/initiate', protect, initiatePayFastPayment);
export default router;
