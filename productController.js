import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Review from '../models/Review.js';

export const getProducts = async (req, res) => {
  try {
    const { category, brand, minPrice, maxPrice, search, page = 1, limit = 12, sort = '-createdAt' } = req.query;
    const query = { isActive: true };

    if (category) query.category = category;
    if (brand) query.brand = new RegExp(brand, 'i');
    if (minPrice || maxPrice) query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
    if (search) query.$text = { $search: search };

    const colors = req.query.colors || req.query.color;
    if (colors) {
      const colorsList = Array.isArray(colors)
        ? colors
        : String(colors).split(',').map(c => c.trim()).filter(Boolean);
      query.colors = { $in: colorsList.map(c => new RegExp(c, 'i')) };
    }

    const total = await Product.countDocuments(query);
    if (colors && total === 0) {
      return res.status(404).json({ success: false, message: 'No products found matching the requested colors' });
    }

    const products = await Product.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, products, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Find all reviews for this product from the Review collection
    const dbReviews = await Review.find({ productId: req.params.id }).sort('-createdAt');

    // Find all orders containing this product that were delivered to verify purchasers
    const orders = await Order.find({
      'items.product': req.params.id,
      status: 'delivered'
    }).select('user');

    const purchasers = new Set(orders.map(o => o.user.toString()));

    const productObj = product.toObject();
    productObj.reviews = dbReviews.map(r => ({
      _id: r._id,
      user: r.userId,
      username: r.userName,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      helpfulVotes: r.helpfulVotes,
      isVerified: r.isVerified || purchasers.has(r.userId.toString()),
      createdAt: r.createdAt
    }));

    res.json({ success: true, product: productObj });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Product removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const BAD_WORDS = ['spam', 'scam', 'fake', 'abuse', 'shit', 'asshole', 'fuck', 'bitch', 'crap'];
const SPAM_LINK_REGEX = /https?:\/\/[^\s]+|www\.[^\s]+/gi;

const containsProfanityOrSpam = (text) => {
  if (!text) return false;
  if (SPAM_LINK_REGEX.test(text)) return true;
  const normalized = text.toLowerCase();
  return BAD_WORDS.some(word => new RegExp(`\\b${word}\\b`, 'i').test(normalized));
};

export const addReview = async (req, res) => {
  try {
    const { rating, comment, title } = req.body;
    if (containsProfanityOrSpam(title) || containsProfanityOrSpam(comment)) {
      return res.status(400).json({ success: false, message: 'Review contains inappropriate language or spam links.' });
    }
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Check if already reviewed in the new collection
    const alreadyReviewed = await Review.findOne({ productId: req.params.id, userId: req.user._id });
    if (alreadyReviewed) return res.status(400).json({ success: false, message: 'Already reviewed' });

    // Verify if reviewer is a purchaser and the order was successfully delivered
    const hasPurchased = await Order.findOne({
      user: req.user._id,
      'items.product': req.params.id,
      status: 'delivered'
    });

    // Create the review using the new Review model
    const newReview = await Review.create({
      productId: req.params.id,
      userId: req.user._id,
      userName: req.user.username,
      rating,
      title: title || 'Product Review',
      comment,
      isVerified: !!hasPurchased
    });

    // Update Product average ratings and numReviews
    const allReviews = await Review.find({ productId: req.params.id });
    const computedAvg = allReviews.length > 0
      ? allReviews.reduce((acc, r) => acc + r.rating, 0) / allReviews.length
      : 0;
    
    product.numReviews = allReviews.length;
    product.ratings = computedAvg;
    product.totalReviews = allReviews.length;
    product.averageRating = computedAvg;
    
    // Maintain for legacy embed query compatibility
    product.reviews.push({ user: req.user._id, username: req.user.username, rating, comment });
    await product.save();

    res.status(201).json({ success: true, message: 'Review added', review: newReview });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteReview = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Remove from standalone Review collection
    await Review.deleteOne({ _id: req.params.reviewId });

    // Remove from product legacy embed reviews array
    product.reviews = product.reviews.filter(r => r._id.toString() !== req.params.reviewId && r.user?.toString() !== req.params.reviewId);

    // Recalculate average ratings and numReviews
    const allReviews = await Review.find({ productId: req.params.id });
    const computedAvg = allReviews.length > 0
      ? allReviews.reduce((acc, r) => acc + r.rating, 0) / allReviews.length
      : 0;

    product.numReviews = allReviews.length;
    product.ratings = computedAvg;
    product.totalReviews = allReviews.length;
    product.averageRating = computedAvg;
    await product.save();

    res.json({ success: true, message: 'Review deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find({}).sort('-createdAt').populate('productId', 'name');
    res.json({ success: true, reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const searchByAI = async (req, res) => {
  try {
    const { query } = req.body;
    // Parse natural language query to get filters and matched metadata
    const { filters, matchedColor } = parseNLQuery(query);
    
    const products = await Product.find({ isActive: true, ...filters }).limit(6);
    
    if (products.length === 0 && filters.colors) {
      return res.status(404).json({ success: false, message: 'No products found matching the requested colors' });
    }
    
    // Response mein products ke sath matchedColor bhi bhej rahe hain frontend context preservation ke liye
    res.json({ 
      success: true, 
      products, 
      matchedColor: matchedColor || null 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

function parseNLQuery(query) {
  const filters = {};
  let matchedColor = '';
  const q = query.toLowerCase();

  const categories = ['shirt', 'pants', 'shoes', 'watch', 'jacket', 'dress'];
  for (const cat of categories) {
    if (q.includes(cat)) {
      filters.category = cat === 'shirt' ? 'shirts' : cat === 'pants' ? 'pants' : cat + 's';
      break;
    }
  }

  const brands = ['levis', 'levi\'s', 'nike', 'adidas', 'gucci', 'zara'];
  for (const brand of brands) {
    if (q.includes(brand)) { filters.brand = new RegExp(brand, 'i'); break; }
  }

  const priceMatch = q.match(/(?:under|below|less than)\s*(?:rs\.?\s*)?(\d+)/i);
  if (priceMatch) filters.price = { $lte: parseInt(priceMatch[1]) };

  const commonColors = ['red', 'black', 'white', 'blue', 'green', 'yellow', 'brown', 'grey', 'gray', 'pink', 'purple', 'maroon'];
  const matchedColorsList = [];
  for (const color of commonColors) {
    if (new RegExp(`\\b${color}\\b`, 'i').test(q)) {
      matchedColorsList.push(color);
    }
  }
  if (matchedColorsList.length > 0) {
    filters.colors = { $in: matchedColorsList.map(c => new RegExp(c, 'i')) };
    matchedColor = matchedColorsList.join(',');
  }

  return { filters, matchedColor };
}