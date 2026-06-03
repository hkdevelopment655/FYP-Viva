import express from 'express';
import {
  createGiftPool, getGiftPool, updateGiftOptions,
  contribute, setCustomAmount, confirmGiftOrder, getGroupGiftPools,
} from '../controllers/giftPoolController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/',                          protect, createGiftPool);
router.get('/group/:groupCartId',         protect, getGroupGiftPools);
router.get('/:id',                        protect, getGiftPool);
router.put('/:id/options',               protect, updateGiftOptions);
router.post('/:id/contribute',           protect, contribute);
router.put('/:id/custom-amount',         protect, setCustomAmount);
router.post('/:id/confirm',              protect, confirmGiftOrder);

export default router;
