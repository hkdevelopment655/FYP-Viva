import mongoose from 'mongoose';

const groupMessageSchema = new mongoose.Schema({
  groupCart: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GroupCart',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
});

export default mongoose.model('GroupMessage', groupMessageSchema);
