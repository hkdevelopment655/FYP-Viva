import { v4 as uuidv4 } from 'uuid';
import GiftPool from '../models/GiftPool.js';
import GroupCart from '../models/GroupCart.js';

const WRAPPING_COSTS = { none: 0, classic: 150, premium: 250, luxury: 350 };

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcTarget(items = [], wrapping = {}) {
  const itemsTotal = items.reduce((s, i) => s + (i.price * (i.quantity || 1)), 0);
  const wrapCost   = WRAPPING_COSTS[wrapping.style] || 0;
  return itemsTotal + wrapCost;
}

function calcEqualShare(targetAmount, memberCount) {
  if (!memberCount) return targetAmount;
  return Math.ceil(targetAmount / memberCount);   // round up so total always covers
}

// ── Create gift pool ─────────────────────────────────────────────────────────

export const createGiftPool = async (req, res) => {
  try {
    const {
      groupCartId, occasionName, occasionDate,
      items = [], wrapping = {}, personalNote = {},
      eCard = {}, contributionMode = 'equal', recipient,
    } = req.body;

    const groupCart = await GroupCart.findById(groupCartId);
    if (!groupCart)
      return res.status(404).json({ success: false, message: 'Group cart not found' });

    const isGroupAdmin = groupCart.admin.toString() === req.user._id.toString();
    const isSysAdmin = req.user.role === 'admin';
    if (!isGroupAdmin && !isSysAdmin)
      return res.status(403).json({ success: false, message: 'Only admin can create a gift pool' });

    const targetAmount = calcTarget(items, wrapping);
    const memberCount  = groupCart.members.filter(m => m.status === 'accepted').length;
    const shareLink    = uuidv4();

    // Pre-calculate equal contributions
    const contributions = groupCart.members
      .filter(m => m.status === 'accepted')
      .map(m => ({
        user:     m.user,
        username: m.username,
        email:    m.email,
        amount:   contributionMode === 'equal' ? calcEqualShare(targetAmount, memberCount) : 0,
        mode:     contributionMode,
        isPaid:   false,
      }));

    const giftPool = await GiftPool.create({
      groupCart: groupCartId,
      admin:     req.user._id,
      occasionName, occasionDate,
      items, wrapping, personalNote, eCard,
      contributionMode, recipient,
      targetAmount,
      raisedAmount: 0,
      contributions,
      shareLink,
    });

    // Notify group via socket
    req.io?.to(`group-${groupCartId}`).emit('gift-pool-created', {
      giftPoolId: giftPool._id,
      occasionName,
      targetAmount,
    });

    res.status(201).json({ success: true, giftPool });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get gift pool ─────────────────────────────────────────────────────────────

export const getGiftPool = async (req, res) => {
  try {
    const giftPool = await GiftPool.findById(req.params.id)
      .populate('admin',         'username email avatar')
      .populate('items.product', 'name images price')
      .populate('contributions.user', 'username email avatar');

    if (!giftPool)
      return res.status(404).json({ success: false, message: 'Gift pool not found' });

    // Strip recipient details from non-admins
    const isAdmin = giftPool.admin._id.toString() === req.user._id.toString();
    const data    = giftPool.toJSON();
    if (!isAdmin) delete data.recipient;

    res.json({ success: true, giftPool: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Update gift options (wrapping, note, ecard) ───────────────────────────────

export const updateGiftOptions = async (req, res) => {
  try {
    const giftPool = await GiftPool.findById(req.params.id);
    if (!giftPool)
      return res.status(404).json({ success: false, message: 'Gift pool not found' });

    const isAdmin = giftPool.admin.toString() === req.user._id.toString();

    // Anyone can edit the shared note if isShared is true
    if (req.body.personalNote && !isAdmin) {
      if (!giftPool.personalNote.isShared)
        return res.status(403).json({ success: false, message: 'Note editing is restricted to admin' });
      giftPool.personalNote.message = req.body.personalNote.message;
    }

    if (isAdmin) {
      if (req.body.wrapping) {
        giftPool.wrapping = req.body.wrapping;
        // Recalculate target when wrapping changes
        giftPool.targetAmount = calcTarget(giftPool.items, giftPool.wrapping);
        if (giftPool.contributionMode === 'equal') {
          const paidCount = giftPool.contributions.filter(c => !c.isPaid).length;
          const share     = calcEqualShare(giftPool.targetAmount, giftPool.contributions.length);
          giftPool.contributions.forEach(c => { if (!c.isPaid) c.amount = share; });
        }
      }
      if (req.body.personalNote) giftPool.personalNote = { ...giftPool.personalNote, ...req.body.personalNote };
      if (req.body.eCard)         giftPool.eCard        = req.body.eCard;
      if (req.body.occasionName)  giftPool.occasionName = req.body.occasionName;
      if (req.body.occasionDate)  giftPool.occasionDate = req.body.occasionDate;
    }

    await giftPool.save();
    req.io?.to(`group-${giftPool.groupCart}`).emit('gift-pool-updated', { giftPool });
    res.json({ success: true, giftPool });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Contribute (pay my share) ─────────────────────────────────────────────────

export const contribute = async (req, res) => {
  try {
    const { amount, transactionId } = req.body;
    const giftPool = await GiftPool.findById(req.params.id);
    if (!giftPool)
      return res.status(404).json({ success: false, message: 'Gift pool not found' });

    if (giftPool.status !== 'open')
      return res.status(400).json({ success: false, message: 'Gift pool is no longer accepting contributions' });

    // Find this user's contribution slot
    const slot = giftPool.contributions.find(
      c => c.user?.toString() === req.user._id.toString() || c.email === req.user.email
    );
    if (!slot)
      return res.status(403).json({ success: false, message: 'You are not a member of this gift pool' });

    if (slot.isPaid)
      return res.status(400).json({ success: false, message: 'You have already contributed' });

    // For custom mode, use the amount provided; for equal/full use pre-set amount
    const paidAmount = giftPool.contributionMode === 'custom' ? amount : slot.amount;

    slot.isPaid       = true;
    slot.paidAt       = new Date();
    slot.amount       = paidAmount;
    slot.transactionId = transactionId;

    giftPool.raisedAmount = giftPool.contributions
      .filter(c => c.isPaid)
      .reduce((s, c) => s + c.amount, 0);

    if (giftPool.raisedAmount >= giftPool.targetAmount) {
      giftPool.status = 'fully_funded';
    }

    await giftPool.save();

    req.io?.to(`group-${giftPool.groupCart}`).emit('contribution-made', {
      username:  req.user.username,
      amount:    paidAmount,
      raised:    giftPool.raisedAmount,
      target:    giftPool.targetAmount,
      percent:   giftPool.fundingPercent,
      status:    giftPool.status,
    });

    res.json({ success: true, giftPool, message: 'Contribution recorded!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Set custom contribution amount ────────────────────────────────────────────

export const setCustomAmount = async (req, res) => {
  try {
    const { amount } = req.body;
    const giftPool = await GiftPool.findById(req.params.id);
    if (!giftPool)
      return res.status(404).json({ success: false, message: 'Gift pool not found' });

    if (giftPool.contributionMode !== 'custom')
      return res.status(400).json({ success: false, message: 'Only allowed in custom mode' });

    const slot = giftPool.contributions.find(
      c => c.user?.toString() === req.user._id.toString()
    );
    if (!slot || slot.isPaid)
      return res.status(400).json({ success: false, message: 'Cannot update amount after payment' });

    slot.amount = amount;
    await giftPool.save();
    res.json({ success: true, message: 'Amount updated', giftPool });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Confirm & place order (admin only) ────────────────────────────────────────

export const confirmGiftOrder = async (req, res) => {
  try {
    const giftPool = await GiftPool.findById(req.params.id);
    if (!giftPool)
      return res.status(404).json({ success: false, message: 'Gift pool not found' });

    if (giftPool.admin.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Only admin can confirm' });

    if (giftPool.status !== 'fully_funded' && giftPool.raisedAmount < giftPool.targetAmount)
      return res.status(400).json({ success: false, message: `Still Rs. ${giftPool.remaining} short` });

    giftPool.status   = 'ordered';
    giftPool.isActive = false;
    await giftPool.save();

    req.io?.to(`group-${giftPool.groupCart}`).emit('gift-ordered', {
      occasionName: giftPool.occasionName,
      message: 'Gift has been ordered and will be dispatched soon!',
    });

    res.json({ success: true, message: 'Gift order placed! Group will be removed after delivery.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get all gift pools for a group cart ──────────────────────────────────────

export const getGroupGiftPools = async (req, res) => {
  try {
    const pools = await GiftPool.find({ groupCart: req.params.groupCartId, isActive: true })
      .populate('items.product', 'name images price');
    res.json({ success: true, giftPools: pools });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
