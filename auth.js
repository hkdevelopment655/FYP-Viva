// Auth routes
import express from 'express';
import { 
  register, 
  login, 
  getMe, 
  updateProfile, 
  forgotPassword, 
  resetPassword, 
  socialLogin,
  deleteAccount
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/social-login', socialLogin); // Social Auth Endpoint
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.delete('/profile', protect, deleteAccount);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

export default router;
