import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  email: { type: String, required: true },
  username: { type: String },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'accepted' },
  hasPaid: { type: Boolean, default: false },
  paymentAmount: { type: Number, default: 0 }
});

const itemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String, required: true },
  image: { type: String },
  price: { type: Number, required: true },
  size: { type: String, default: 'M' }
});

const recipientSchema = new mongoose.Schema({
  name: { type: String },
  address: { type: String },
  phone: { type: String }
});

const groupCartSchema = new mongoose.Schema({
  name: { type: String, required: true },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [memberSchema],
  items: [itemSchema],
  recipient: { type: recipientSchema, default: () => ({}) },
  shareLink: { type: String, required: true, unique: true },
  totalPrice: { type: Number, default: 0 },
  pricePerMember: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  isConfirmedByAdmin: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

export default mongoose.model('GroupCart', groupCartSchema);