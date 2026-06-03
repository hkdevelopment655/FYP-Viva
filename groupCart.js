import express from 'express';
import {
  createGroupCart,
  getGroupCart,
  getUserGroupCarts,
  addItemToGroupCart,
  removeItemFromGroupCart,
  joinGroupCart,
  confirmGroupOrder,
  deleteGroupCart,
  getAllRegisteredUsers,
  payMemberShare,
  markMemberPaid,
  getGroupMessages,
  sendGroupMessage
} from '../controllers/groupCartController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.get('/users/all', protect, getAllRegisteredUsers);
router.post('/', protect, createGroupCart);
router.get('/', protect, getUserGroupCarts);
router.get('/join/:shareLink', protect, joinGroupCart);
router.get('/:id', protect, getGroupCart);
router.post('/:id/items', protect, addItemToGroupCart);
router.delete('/:id/items/:itemId', protect, removeItemFromGroupCart);
router.delete('/:id', protect, deleteGroupCart);
router.post('/:id/confirm', protect, confirmGroupOrder);
router.post('/:id/pay-share', protect, payMemberShare);
router.post('/:id/members/:memberId/pay', protect, markMemberPaid);
router.patch('/:id/members/:memberId/paid', protect, markMemberPaid);
router.get('/:id/messages', protect, getGroupMessages);
router.post('/:id/messages', protect, sendGroupMessage);

export default router;
