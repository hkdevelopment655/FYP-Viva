import crypto from 'crypto';
import Order from '../models/Order.js';

// Easypaisa Payment Gateway Integration
// Docs: https://sandbox.easypaisa.com.pk/tpg/

const EASYPAISA_CONFIG = {
  storeId: process.env.EASYPAISA_STORE_ID,
  hashKey: process.env.EASYPAISA_HASH_KEY,
  accountNum: process.env.EASYPAISA_ACCOUNT_NUMBER,
  baseUrl: process.env.EASYPAISA_ENV === 'production'
    ? 'https://easypaisa.com.pk/tpg/'
    : 'https://sandbox.easypaisa.com.pk/tpg/'
};

const generateEasypaisaHash = (params) => {
  // Sort params alphabetically and concatenate
  const sortedKeys = Object.keys(params).sort();
  const hashString = sortedKeys.map(k => params[k]).join('&') + '&' + EASYPAISA_CONFIG.hashKey;
  return crypto.createHash('sha256').update(hashString).digest('base64');
};

export const initiatePayment = async (req, res) => {
  try {
    const { orderId, amount, phoneNumber } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const transactionDateTime = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const transactionRefNum = `SMARTAI-${Date.now()}`;

    const params = {
      amount: amount.toFixed(2),
      orderRefNum: transactionRefNum,
      paymentMethod: 'MA_ACCOUNT',
      postBackURL: `${process.env.CLIENT_URL}/payment/callback`,
      storeId: EASYPAISA_CONFIG.storeId,
      timeStamp: transactionDateTime,
      token: crypto.randomBytes(16).toString('hex')
    };

    params.hash = generateEasypaisaHash(params);

    // For mobile account (MA) payment
    const maPaymentPayload = {
      ...params,
      mobileAccountNo: phoneNumber,
      emailAddress: req.user.email
    };

    res.json({
      success: true,
      paymentUrl: EASYPAISA_CONFIG.baseUrl,
      payload: maPaymentPayload,
      transactionRef: transactionRefNum,
      message: 'Payment initiated. Please confirm on your Easypaisa app.'
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

export const paymentCallback = async (req, res) => {
  try {
    const { orderRefNum, transactionId, responseCode } = req.body;
    // Verify hash
    const isSuccess = responseCode === '0000';
    res.json({ success: isSuccess, transactionId, orderRefNum });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createOrder = async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod = 'easypaisa', groupCartId } = req.body;
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

    // Check if current user is owner OR admin
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
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const payfastData = {
      merchant_id: process.env.PAYFAST_MERCHANT_ID || '10049693',
      merchant_key: process.env.PAYFAST_MERCHANT_KEY || 'tk3co8d1lltic',
      return_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/checkout?step=2&orderId=${orderId}` + (order.groupCartId ? `&groupCartId=${order.groupCartId}` : ''),
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/checkout` + (order.groupCartId ? `?groupCartId=${order.groupCartId}` : ''),
      m_payment_id: orderId.toString(),
      amount: order.totalPrice.toFixed(2),
      item_name: `SmartAI-Order-${orderId}`
    };

    // Calculate MD5 signature
    const orderedKeys = [
      'merchant_id', 'merchant_key', 'return_url', 'cancel_url', 'notify_url',
      'name_first', 'name_last', 'email_address', 'cell_number',
      'm_payment_id', 'amount', 'item_name', 'item_description'
    ];

    let signatureString = '';
    orderedKeys.forEach((key) => {
      if (payfastData[key] !== undefined && payfastData[key] !== '') {
        const encodedValue = encodeURIComponent(payfastData[key])
          .replace(/%20/g, '+')
          .replace(/%[0-9a-fA-F]{2}/g, (match) => match.toUpperCase());
        signatureString += `${key}=${encodedValue}&`;
      }
    });

    // Remove trailing '&'
    if (signatureString.endsWith('&')) {
      signatureString = signatureString.slice(0, -1);
    }

    const signature = crypto.createHash('md5').update(signatureString).digest('hex');
    payfastData.signature = signature;

    res.json({
      success: true,
      paymentUrl: 'https://sandbox.payfast.co.za/eng/process',
      payload: payfastData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


