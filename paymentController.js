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

    // EXACT FIX: Aggressively load keys from env or use standard validated fallback strings
    const merchantId = (process.env.PAYFAST_MERCHANT_ID || '10049693').trim();
    const merchantKey = (process.env.PAYFAST_MERCHANT_KEY || 'tk3co8d1lltic').trim();

    const payfastData = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/checkout?step=2&orderId=${orderId}` + (order.groupCartId ? `&groupCartId=${order.groupCartId}` : ''),
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/checkout` + (order.groupCartId ? `?groupCartId=${order.groupCartId}` : ''),
      m_payment_id: orderId.toString(),
      amount: order.totalPrice.toFixed(2),
      item_name: `SmartAI-Order-${orderId}`
    };

    // Strict parameter sequence generation according to PayFast standards
    const orderedKeys = [
      'merchant_id',
      'merchant_key',
      'return_url',
      'cancel_url',
      'm_payment_id',
      'amount',
      'item_name'
    ];

    let signatureString = '';
    orderedKeys.forEach((key) => {
      if (payfastData[key] !== undefined && payfastData[key] !== '') {
        const encodedValue = encodeURIComponent(payfastData[key].toString())
          .replace(/%20/g, '+')
          .replace(/%[0-9a-fA-F]{2}/g, (match) => match.toUpperCase());
        signatureString += `${key}=${encodedValue}&`;
      }
    });

    // Strip trailing ampersand
    if (signatureString.endsWith('&')) {
      signatureString = signatureString.slice(0, -1);
    }

    // CRITICAL: PayFast architecture expects MD5 calculation matching the parameter construction
    const signature = crypto.createHash('md5').update(signatureString).digest('hex');
    payfastData.signature = signature;

    console.log("--- DEBUG PAYFAST LOGS ---");
    console.log("Merchant ID sent:", merchantId);
    console.log("Built Payload String:", signatureString);
    console.log("Generated Hash:", signature);

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
