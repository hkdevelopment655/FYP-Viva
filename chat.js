import express from 'express';
import { chat, getChatHistory, getRecommendations, deleteChatSession } from '../controllers/chatController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.post('/message',         protect, chat);
router.get('/history',          protect, getChatHistory);
router.get('/recommendations',  protect, getRecommendations);
router.delete('/session/:id',   protect, deleteChatSession);

export default router;
