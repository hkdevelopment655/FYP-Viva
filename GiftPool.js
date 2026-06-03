import mongoose from 'mongoose';

const contributionSchema = new mongoose.Schema({
  user:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username:      String,
  email:         String,
  amount:        { type: Number, required: true },      // Rs. contributed
  mode:          { type: String, enum: ['equal', 'custom', 'full'], default: 'equal' },
  isPaid:        { type: Boolean, default: false },
  paidAt:        Date,
  transactionId: String,
}, { timestamps: true });

const giftItemSchema = new mongoose.Schema({
  product:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name:     String,
  image:    String,
  price:    Number,
  size:     String,
  color:    String,
  quantity: { type: Number, default: 1 },
});

const wrappingSchema = new mongoose.Schema({
  style:       { type: String, enum: ['none', 'classic', 'premium', 'luxury'], default: 'none' },
  color:       String,
  ribbon:      { type: Boolean, default: false },
  extraCost:   { type: Number, default: 0 },   // Rs. 0 / 150 / 250 / 350
});

const giftPoolSchema = new mongoose.Schema({
  // ── Core ────────────────────────────────────────────────────────────────
  groupCart:   { type: mongoose.Schema.Types.ObjectId, ref: 'GroupCart', required: true },
  admin:       { type: mongoose.Schema.Types.ObjectId, ref: 'User',      required: true },
  occasionName:  String,                        // e.g. "Hamza's Birthday"
  occasionDate:  Date,                          // scheduled delivery date

  // ── Items ────────────────────────────────────────────────────────────────
  items:       [giftItemSchema],

  // ── Gift extras ─────────────────────────────────────────────────────────
  wrapping:    { type: wrappingSchema, default: () => ({}) },
  personalNote:{
    message:   { type: String, maxlength: 500 },
    from:      String,                          // "From: The Class of 2026"
    isShared:  { type: Boolean, default: true } // all members can edit?
  },
  eCard: {
    enabled:   { type: Boolean, default: false },
    template:  { type: String, enum: ['birthday', 'wedding', 'graduation', 'eid', 'custom'] },
    imageUrl:  String,
  },

  // ── Funding ─────────────────────────────────────────────────────────────
  targetAmount:     Number,        // itemsTotal + wrappingCost
  raisedAmount:     { type: Number, default: 0 },
  contributionMode: { type: String, enum: ['equal', 'custom', 'full'], default: 'equal' },
  contributions:    [contributionSchema],

  // ── Status ───────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['open', 'fully_funded', 'ordered', 'dispatched', 'delivered', 'cancelled'],
    default: 'open'
  },

  // ── Recipient (kept private from group members) ──────────────────────────
  recipient: {
    name:       String,
    phone:      String,
    address:    String,
    city:       String,
    postalCode: String,
    isPrivate:  { type: Boolean, default: true }, // never expose to members
  },

  shareLink: { type: String, unique: true },
  isActive:  { type: Boolean, default: true },
}, { timestamps: true });

// Virtual: percentage funded
giftPoolSchema.virtual('fundingPercent').get(function () {
  if (!this.targetAmount) return 0;
  return Math.min(100, Math.round((this.raisedAmount / this.targetAmount) * 100));
});

// Virtual: amount still needed
giftPoolSchema.virtual('remaining').get(function () {
  return Math.max(0, (this.targetAmount || 0) - this.raisedAmount);
});

giftPoolSchema.set('toJSON', { virtuals: true });

export default mongoose.model('GiftPool', giftPoolSchema);
