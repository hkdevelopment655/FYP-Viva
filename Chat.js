import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  messages: [{
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: String,
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    timestamp: { type: Date, default: Date.now }
  }],
  sessionId: String
}, { timestamps: true });

export default mongoose.model('Chat', chatSchema);
