import 'dotenv/config'; // Crucial: Loads variables at the very beginning
import express from 'express';
import crypto from 'crypto';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import connectDB from './config/database.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import chatRoutes from './routes/chat.js';
import orderRoutes from './routes/orders.js';
import groupCartRoutes from './routes/groupCart.js';
import paymentRoutes from './routes/payment.js';
import adminRoutes from './routes/admin.js';
import giftPoolRoutes from './routes/giftPool.js';
import aiRoutes from './routes/ai.js';
import { errorHandler } from './middleware/errorHandler.js';
import { setupSocketHandlers } from './utils/socketHandlers.js';
 
// ── Load .env ─────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const envFile    = join(__dirname, '..', '.env');   
 
dotenv.config({ path: envFile, override: true });
 
// Environment Status Logging
console.log('📁 .env path:', envFile);
console.log('🗄️  MONGODB_URI:', process.env.MONGODB_URI ? 'SET ✅' : 'NOT SET ❌');
console.log('🔑 PAYFAST_MERCHANT_ID:', process.env.PAYFAST_MERCHANT_ID ? 'LOADED ✅' : 'NOT SET ❌');
console.log('🔑 PAYFAST_MERCHANT_KEY:', process.env.PAYFAST_MERCHANT_KEY ? 'LOADED ✅' : 'NOT SET ❌');
console.log('🔑 GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.slice(0, 10) + '...' : 'NOT SET ❌');
// ─────────────────────────────────────────────────────────────────────────────
 
connectDB();
 
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});
 
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static('uploads'));
 
app.use((req, res, next) => { req.io = io; next(); });
 
// Main Application Routing
app.use('/api/auth',       authRoutes);
app.use('/api/products',   productRoutes);
app.use('/api/chat',       chatRoutes);
app.use('/api/orders',     orderRoutes);
app.use('/api/group-cart', groupCartRoutes);
app.use('/api/payment',    paymentRoutes); // This handles the structured PayFast flows safely
app.use('/api/admin',      adminRoutes);
app.use('/api/gift-pool',  giftPoolRoutes);
app.use('/api/ai',         aiRoutes);
 
app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));
 
setupSocketHandlers(io);
app.use(errorHandler);
 
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`🚀 Smart AI Server running on port ${PORT}`));
 
export default app;
