import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: String,
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: String
}, { timestamps: true });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  brand: { type: String, required: true },
  description: String,
  curatorNote: String,
  price: { type: Number, required: true, min: 0 },
  originalPrice: Number,
  category: {
    type: String,
    enum: ['shirts', 'pants', 'shoes', 'watches', 'accessories', 'jackets', 'dresses'],
    required: true
  },
  subcategory: String,
  images: [String],
  sizes: [{ type: String }],
  colors: [String],
  colorImages: [{
    color: { type: String, required: true },
    image: { type: String, required: true }
  }],
  stock: { type: Number, default: 0 },
  tags: [String],
  ratings: { type: Number, default: 0 },
  numReviews: { type: Number, default: 0 },
  averageRating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  reviews: [reviewSchema],
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  embeddings: [Number], // for AI similarity search
}, { timestamps: true });

productSchema.index({ name: 'text', brand: 'text', description: 'text', tags: 'text' });

export default mongoose.model('Product', productSchema);
