import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    image: String,
    price: Number,
    quantity: { type: Number, default: 1 },
    size: String,
    color: String
  }],
  shippingAddress: {
    fullName: String,
    address: String,
    city: String,
    postalCode: String,
    phone: String
  },
  paymentMethod: { type: String, default: 'easypaisa' },
  paymentResult: {
    id: String,
    status: String,
    transactionId: String,
    updateTime: String
  },
  subtotal: Number,
  shippingPrice: { type: Number, default: 0 },
  totalPrice: Number,
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  isGroupOrder: { type: Boolean, default: false },
  groupCartId: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupCart' },
  isPaid: { type: Boolean, default: false },
  paidAt: Date,
  isDelivered: { type: Boolean, default: false },
  deliveredAt: Date
}, { timestamps: true });

export default mongoose.model('Order', orderSchema);
