import crypto from 'crypto';
import Order from '../models/Order.js';

// PayFast Sandbox URL Configuration
const PAYFAST_URL = 'https://sandbox.payfast.co.za/eng/process';

export const createOrder = async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod = 'card', groupCartId } = req.body;
    const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const shippingPrice = subtotal > 2000 ? 0 : 150;
    const totalPrice = subtotal + shippingPrice;

    const isCard = paymentMethod === 'card';

    const order = await Order.create({
      user: req.user._id,
      items,
      shippingAddress,
      paymentMethod,
      subtotal,
      shippingPrice,
      totalPrice,
      groupCartId,
      isPaid: isCard,
      paidAt: isCard ? new Date() : undefined,
      status: isCard ? 'processing' : 'pending'
    });

    res.status(201).json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort('-createdAt').populate('items.product', 'name images');
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.product', 'name images')
      .populate('user', 'name email');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to view this order' });
    }

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const initiatePayFastPayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Explicit valid working values loading directly
    const merchantId = (process.env.PAYFAST_MERCHANT_ID || '10049693').trim();
    const merchantKey = (process.env.PAYFAST_MERCHANT_KEY || 'tk3co8d1lltic').trim();

    const amountStr = order.totalPrice.toFixed(2);
    const itemNameStr = `SmartAI-Order-${orderId}`;
    const returnUrlStr = `${process.env.CLIENT_URL || 'http://localhost:5173'}/checkout?step=2&orderId=${orderId}` + (order.groupCartId ? `&groupCartId=${order.groupCartId}` : '');
    const cancelUrlStr = `${process.env.CLIENT_URL || 'http://localhost:5173'}/checkout` + (order.groupCartId ? `?groupCartId=${order.groupCartId}` : '');
    const mPaymentIdStr = orderId.toString();

    // STRICT EXPLICIT URL STRINGS FOR SIGNATURE GENERATION (NO LOOPS)
    const signatureString = 
      `merchant_id=${encodeURIComponent(merchantId).replace(/%20/g, '+')}&` +
      `merchant_key=${encodeURIComponent(merchantKey).replace(/%20/g, '+')}&` +
      `return_url=${encodeURIComponent(returnUrlStr).replace(/%20/g, '+')}&` +
      `cancel_url=${encodeURIComponent(cancelUrlStr).replace(/%20/g, '+')}&` +
      `m_payment_id=${encodeURIComponent(mPaymentIdStr).replace(/%20/g, '+')}&` +
      `amount=${encodeURIComponent(amountStr).replace(/%20/g, '+')}&` +
      `item_name=${encodeURIComponent(itemNameStr).replace(/%20/g, '+')}`;

    // MD5 Signature calculation
    const signature = crypto.createHash('md5').update(signatureString).digest('hex');

    const payfastData = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: returnUrlStr,
      cancel_url: cancelUrlStr,
      m_payment_id: mPaymentIdStr,
      amount: amountStr,
      item_name: itemNameStr,
      signature: signature
    };

    console.log("--- FINAL PRODUCTION SIGNATURE VERIFICATION ---");
    console.log("String hashed:", signatureString);
    console.log("Hash created:", signature);

    res.json({
      success: true,
      paymentUrl: PAYFAST_URL,
      payload: payfastData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { orderId, transactionId, status } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (status === 'SUCCESS' || status === 'PAID') {
      order.isPaid = true;
      order.paidAt = new Date();
      order.status = 'processing';
      order.paymentResult = {
        id: transactionId,
        status: 'PAID',
        transactionId,
        updateTime: new Date().toISOString()
      };
      await order.save();
      res.json({ success: true, message: 'Payment verified', order });
    } else {
      res.json({ success: false, message: 'Payment not completed' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
