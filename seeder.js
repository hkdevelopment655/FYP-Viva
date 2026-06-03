import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

// Inline models to avoid import issues in seeder
const userSchema = new mongoose.Schema({
  username: String, email: String, password: String, role: { type: String, default: 'user' }, avatar: String,
  preferences: { sizes: [String], styles: [String], brands: [String], colors: [String] },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const productSchema = new mongoose.Schema({
  name: String, brand: String, description: String, curatorNote: String,
  price: Number, originalPrice: Number, category: String, subcategory: String,
  images: [String], sizes: [String], colors: [String], stock: Number, tags: [String],
  ratings: { type: Number, default: 0 }, numReviews: { type: Number, default: 0 },
  reviews: [], isActive: { type: Boolean, default: true }, isFeatured: { type: Boolean, default: false }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', productSchema);

const PRODUCTS = [
  {
    name: "Levi's Classic Red Shirt",
    brand: "Levi's",
    description: "A testament to American heritage tailoring. Heavy-duty cotton weave with precision stitching.",
    curatorNote: "A testament to American heritage tailoring. This specific iteration balances vibrant saturation with the architectural stability of heavy-duty weave. It is not merely a garment, but a primary color study in durable aestheticism.",
    price: 1299, originalPrice: 1799,
    category: "shirts", subcategory: "casual",
    images: ["https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600"],
    sizes: ["S", "M", "L", "XL"], colors: ["red"],
    stock: 50, tags: ["levi's", "red", "shirt", "casual", "classic"], isFeatured: true
  },
  {
    name: "Levi's Crimson Tailored Fit",
    brand: "Levi's",
    description: "Slim-fit silhouette with premium crimson dye. Designed for the modern scholar.",
    curatorNote: "Engineered for precision silhouette. The crimson dye is set in a 3-bath process ensuring fade-resistance across 200+ wash cycles.",
    price: 1450, originalPrice: 1999,
    category: "shirts",
    images: ["https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=600"],
    sizes: ["S", "M", "L", "XL"], colors: ["red", "crimson"],
    stock: 35, tags: ["levi's", "crimson", "tailored", "shirt", "slim"]
  },
  {
    name: "Levi's Heritage Red Cotton",
    brand: "Levi's",
    description: "Classic heritage weave in deep red. A wardrobe cornerstone.",
    curatorNote: "Heritage craftsmanship meets contemporary silhouette. The 100% cotton construction breathes with the rhythm of daily life.",
    price: 1199, originalPrice: 1599,
    category: "shirts",
    images: ["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600"],
    sizes: ["M", "L", "XL", "XXL"], colors: ["red"],
    stock: 42, tags: ["levi's", "red", "heritage", "cotton", "shirt"]
  },
  {
    name: "Nike Air Max 270",
    brand: "Nike",
    description: "Engineered for maximum comfort. The tallest Air unit yet delivers all-day cushioning.",
    curatorNote: "A feat of pneumatic engineering. The Air Max 270 unit represents the pinnacle of cushioning technology, offering 270 degrees of visibility and unmatched heel comfort.",
    price: 18999, originalPrice: 22999,
    category: "shoes",
    images: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600"],
    sizes: ["S", "M", "L", "XL"], colors: ["white", "black", "grey"],
    stock: 25, tags: ["nike", "shoes", "air max", "sneakers", "sport"], isFeatured: true
  },
  {
    name: "Classic Heritage Timepiece",
    brand: "Orient",
    description: "Mechanical precision in a timeless case. Water resistant to 50m.",
    curatorNote: "A mechanical symphony in stainless steel. The movement oscillates at 21,600 vibrations per hour, a cadence that defines precision horology.",
    price: 9000, originalPrice: 12000,
    category: "watches",
    images: ["https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=600"],
    sizes: ["M"], colors: ["silver", "gold"],
    stock: 15, tags: ["watch", "mechanical", "heritage", "orient", "luxury"], isFeatured: true
  },
  {
    name: "Slim Chino Trousers",
    brand: "Zara",
    description: "Tailored slim-fit chinos in premium stretch cotton. Versatile and refined.",
    curatorNote: "Architectural precision in every stitch. The 2% elastane content provides structured movement without compromising the clean silhouette.",
    price: 3499, originalPrice: 4999,
    category: "pants",
    images: ["https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=600"],
    sizes: ["S", "M", "L", "XL"], colors: ["navy", "beige", "grey"],
    stock: 60, tags: ["pants", "chino", "zara", "slim", "formal"]
  },
  {
    name: "Minimalist Leather Wallet",
    brand: "Fossil",
    description: "Full-grain leather bifold. Slim profile, maximum capacity.",
    curatorNote: "The Cartesian geometry of personal finance. Eight card slots, one bill compartment, zero compromise.",
    price: 2499, originalPrice: 3499,
    category: "accessories",
    images: ["https://images.unsplash.com/photo-1627123424574-724758594785?w=600"],
    sizes: ["M"], colors: ["brown", "black"],
    stock: 80, tags: ["wallet", "leather", "fossil", "accessories", "minimalist"]
  },
  {
    name: "Heritage Denim Jacket",
    brand: "Levi's",
    description: "The original trucker jacket. Medium wash denim with copper riveting.",
    curatorNote: "Since 1962, this silhouette has been the garment of choice for those who define their own narrative. The medium wash is achieved through a 72-hour stone-wash process.",
    price: 7999, originalPrice: 10999,
    category: "jackets",
    images: ["https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600"],
    sizes: ["S", "M", "L", "XL", "XXL"], colors: ["blue", "medium wash"],
    stock: 30, tags: ["jacket", "denim", "levi's", "trucker", "heritage"], isFeatured: true
  },
  {
    name: "Adidas Ultraboost 22",
    brand: "Adidas",
    description: "Responsive Boost midsole with Primeknit+ upper. Built for distance.",
    curatorNote: "11 million temperature data points informed the engineered climate of this upper. The Boost compound returns 20% more energy than standard EVA foams.",
    price: 22999, originalPrice: 28999,
    category: "shoes",
    images: ["https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600"],
    sizes: ["S", "M", "L", "XL"], colors: ["white", "black", "grey"],
    stock: 20, tags: ["adidas", "ultraboost", "shoes", "running", "sport"]
  },
  {
    name: "Oxford Button-Down Shirt",
    brand: "Ralph Lauren",
    description: "Classic Oxford weave in crisp white. The definitive professional shirt.",
    curatorNote: "The Oxford cloth button-down is not merely a shirt — it is a sociological artifact. This iteration uses a 2×1 basket weave for texture without sacrificing the clean drape.",
    price: 5499, originalPrice: 7999,
    category: "shirts",
    images: ["https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=600"],
    sizes: ["S", "M", "L", "XL"], colors: ["white", "light blue"],
    stock: 45, tags: ["shirt", "oxford", "ralph lauren", "formal", "white", "blue"]
  },
  {
    name: "Slim Fit Black Jeans",
    brand: "Levi's",
    description: "511™ Slim Fit Jeans in jet black stretch denim.",
    curatorNote: "The 511 is the Platonic ideal of the slim jean. Black dye saturation is locked in through a reactive dyeing process that bonds dye molecules to fiber at the molecular level.",
    price: 4999, originalPrice: 6499,
    category: "pants",
    images: ["https://images.unsplash.com/photo-1542272604-787c3835535d?w=600"],
    sizes: ["S", "M", "L", "XL", "XXL"], colors: ["black"],
    stock: 55, tags: ["jeans", "levi's", "slim", "black", "denim"]
  },
  {
    name: "Cashmere V-Neck Sweater",
    brand: "Uniqlo",
    description: "Pure Mongolian cashmere. Exceptional softness with structured silhouette.",
    curatorNote: "Sourced from the Mongolian plateau at altitudes exceeding 1500m. The fiber diameter of 14.5 microns places this cashmere in the premium classification.",
    price: 8999, originalPrice: 12999,
    category: "jackets",
    images: ["https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=600"],
    sizes: ["S", "M", "L", "XL"], colors: ["grey", "navy", "camel"],
    stock: 28, tags: ["sweater", "cashmere", "uniqlo", "knitwear", "luxury"]
  }
];

const USERS = [
  { username: 'admin', email: 'admin@smartai.com', password: 'admin123', role: 'admin' },
  { username: 'hamza', email: 'hamza@smartai.com', password: 'user1234', role: 'user' },
  { username: 'mahmood', email: 'mahmood@smartai.com', password: 'user1234', role: 'user' },
  { username: 'daud', email: 'daud@smartai.com', password: 'user1234', role: 'user' },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-ai-platform');
    console.log('✅ Connected to MongoDB');

    // Clear existing
    await User.deleteMany({});
    await Product.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Seed users
    const hashedUsers = await Promise.all(USERS.map(async u => ({
      ...u, password: await bcrypt.hash(u.password, 12)
    })));
    await User.insertMany(hashedUsers);
    console.log(`👤 Seeded ${USERS.length} users`);

    // Seed products
    await Product.insertMany(PRODUCTS);
    console.log(`📦 Seeded ${PRODUCTS.length} products`);

    console.log('\n🎉 Database seeded successfully!');
    console.log('\nTest credentials:');
    console.log('  Admin   → admin@smartai.com / admin123');
    console.log('  User    → hamza@smartai.com / user1234');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

seed();
