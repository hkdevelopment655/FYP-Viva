import GroupCart from '../models/GroupCart.js';
import User from '../models/User.js';
import GroupMessage from '../models/GroupMessage.js';
import { v4 as uuidv4 } from 'uuid';

// ── Helper: recalculate totals based on ACCEPTED members only ────────────────
const recalcTotals = (groupCart) => {
  groupCart.totalPrice = groupCart.items.reduce((acc, i) => acc + i.price, 0);
  const acceptedCount = groupCart.members.filter(m => m.status === 'accepted').length;
  // Always divide by at least 1 (the admin is always accepted)
  groupCart.pricePerMember = acceptedCount > 0
    ? Math.ceil(groupCart.totalPrice / acceptedCount)   // round up to avoid fractions
    : groupCart.totalPrice;
};

export const createGroupCart = async (req, res) => {
  try {
    console.log('[GroupCart] createGroupCart called by', req.user._id);
    const { name, memberEmails = [], recipient } = req.body;
    const shareLink = uuidv4();

    const registeredUsers = await User.find({ email: { $in: memberEmails } });

    const members = [
      // Admin is immediately 'accepted'
      {
        user:     req.user._id,
        email:    req.user.email,
        username: req.user.username,
        status:   'accepted',
      },
      // Added members are immediately 'accepted' instead of 'pending'
      ...memberEmails.map(email => {
        const regUser = registeredUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (regUser) {
          return {
            user: regUser._id,
            email: regUser.email,
            username: regUser.username,
            status: 'accepted',
          };
        } else {
          // Unregistered user, use their email prefix as username
          const tempUsername = email.split('@')[0];
          return {
            email,
            username: tempUsername,
            status: 'accepted',
          };
        }
      })
    ];

    const groupCart = new GroupCart({
      name,
      admin: req.user._id,
      members,
      recipient,
      shareLink,
      totalPrice:     0,
      pricePerMember: 0,
    });

    recalcTotals(groupCart);
    await groupCart.save();

    await groupCart.populate('admin', '_id username email avatar');
    console.log('[GroupCart] createGroupCart success', groupCart._id);
    res.status(201).json({ success: true, groupCart });
  } catch (error) {
    console.error('[GroupCart] createGroupCart error', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getGroupCart = async (req, res) => {
  try {
    console.log('[GroupCart] getGroupCart called by', req.user._id, 'id', req.params.id);
    const groupCart = await GroupCart.findById(req.params.id)
      .populate('admin', '_id username email avatar')
      .populate('members.user', '_id username email avatar')
      .populate('items.product');

    if (!groupCart) {
      return res.status(404).json({ success: false, message: 'Group cart not found' });
    }

    const isMember = groupCart.members.some(
      m => m.user?._id?.toString() === req.user._id.toString()
        || m.email === req.user.email
    );
    const isAdmin = groupCart.admin?._id?.toString() === req.user._id.toString();

    if (!isMember && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not a member of this group' });
    }

    // Auto-link the user reference if the member matched by email but had no user ID linked yet
    let modified = false;
    groupCart.members.forEach(m => {
      if (m.email.toLowerCase() === req.user.email.toLowerCase() && !m.user) {
        m.user = req.user._id;
        m.username = req.user.username;
        modified = true;
      }
    });

    if (modified) {
      recalcTotals(groupCart);
      await groupCart.save();
      await groupCart.populate('members.user', '_id username email avatar');
    }

    console.log('[GroupCart] getGroupCart success', groupCart._id);
    res.json({ success: true, groupCart });
  } catch (error) {
    console.error('[GroupCart] getGroupCart error', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserGroupCarts = async (req, res) => {
  try {
    console.log('[GroupCart] getUserGroupCarts called by', req.user._id);
    const groupCarts = await GroupCart.find({
      $or: [
        { admin: req.user._id },
        { 'members.email': req.user.email },
        { 'members.user': req.user._id },
      ],
      isActive: true,
    })
      .populate('admin', '_id username')
      .populate('items.product', 'name images price');

    console.log('[GroupCart] getUserGroupCarts success', groupCarts.length, 'carts found');
    res.json({ success: true, groupCarts });
  } catch (error) {
    console.error('[GroupCart] getUserGroupCarts error', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addItemToGroupCart = async (req, res) => {
  try {
    console.log('[GroupCart] addItemToGroupCart called by', req.user._id, 'id', req.params.id);
    const { productId, name, image, price, size } = req.body;
    const groupCart = await GroupCart.findById(req.params.id);
    if (!groupCart) return res.status(404).json({ success: false, message: 'Not found' });

    const isGroupAdmin = groupCart.admin.toString() === req.user._id.toString();
    const isSysAdmin   = req.user.role === 'admin';
    if (!isGroupAdmin && !isSysAdmin) {
      return res.status(403).json({ success: false, message: 'Only the group admin can add items' });
    }

    groupCart.items.push({ product: productId, name, image, price, size });
    recalcTotals(groupCart);
    await groupCart.save();

    req.io?.to(`group-${groupCart._id}`).emit('cart-updated', { groupCart });
    console.log('[GroupCart] addItemToGroupCart success — items:', groupCart.items.length,
                '| total:', groupCart.totalPrice, '| per member:', groupCart.pricePerMember);
    res.json({ success: true, groupCart });
  } catch (error) {
    console.error('[GroupCart] addItemToGroupCart error', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const removeItemFromGroupCart = async (req, res) => {
  try {
    console.log('[GroupCart] removeItemFromGroupCart called by', req.user._id, 'item', req.params.itemId);
    const groupCart = await GroupCart.findById(req.params.id);
    if (!groupCart) return res.status(404).json({ success: false, message: 'Not found' });

    const isGroupAdmin = groupCart.admin.toString() === req.user._id.toString();
    const isSysAdmin   = req.user.role === 'admin';
    if (!isGroupAdmin && !isSysAdmin) {
      return res.status(403).json({ success: false, message: 'Only the group admin can remove items' });
    }

    groupCart.items = groupCart.items.filter(i => i._id.toString() !== req.params.itemId);
    recalcTotals(groupCart);
    await groupCart.save();

    req.io?.to(`group-${groupCart._id}`).emit('cart-updated', { groupCart });
    console.log('[GroupCart] removeItemFromGroupCart success — items:', groupCart.items.length,
                '| per member:', groupCart.pricePerMember);
    res.json({ success: true, groupCart });
  } catch (error) {
    console.error('[GroupCart] removeItemFromGroupCart error', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const joinGroupCart = async (req, res) => {
  try {
    const { shareLink } = req.params;
    const userEmail = req.user.email; // JWT middleware se prapt

    const groupCart = await GroupCart.findOne({ shareLink });
    if (!groupCart) return res.status(404).json({ message: 'Invalid or expired link' });

    // Authorization: Check agar user ki email invite list mein hai
    const member = groupCart.members.find(m => m.email.toLowerCase() === userEmail.toLowerCase());

    if (!member) {
      return res.status(403).json({ message: 'Access Denied: You are not invited to this group.' });
    }

    // Logic: Status update to 'accepted'
    member.user = req.user._id;
    member.username = req.user.username;
    member.status = 'accepted';

    await groupCart.save();
    
    // Success notification via Socket.io
    req.io?.to(`group-${groupCart._id}`).emit('member-joined', { member: req.user.username });
    
    res.json({ success: true, groupCart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markMemberPaid = async (req, res) => {
  try {
    const { memberId } = req.params;
    const groupCart = await GroupCart.findById(req.params.id);
    if (!groupCart) return res.status(404).json({ success: false, message: 'Not found' });

    const isGroupAdmin = groupCart.admin.toString() === req.user._id.toString();
    const isSysAdmin   = req.user.role === 'admin';
    if (!isGroupAdmin && !isSysAdmin) {
      return res.status(403).json({ success: false, message: 'Only admin can mark payments' });
    }

    const member = groupCart.members.id(memberId);
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });

    member.hasPaid       = true;
    member.paymentAmount = groupCart.pricePerMember;
    await groupCart.save();

    req.io?.to(`group-${groupCart._id}`).emit('payment-updated', { memberId, hasPaid: true });
    res.json({ success: true, groupCart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const confirmGroupOrder = async (req, res) => {
  try {
    console.log('[GroupCart] confirmGroupOrder called by', req.user._id, 'id', req.params.id);
    const groupCart = await GroupCart.findById(req.params.id);
    if (!groupCart) return res.status(404).json({ success: false, message: 'Not found' });

    const isGroupAdmin = groupCart.admin.toString() === req.user._id.toString();
    const isSysAdmin   = req.user.role === 'admin';
    if (!isGroupAdmin && !isSysAdmin) {
      return res.status(403).json({ success: false, message: 'Only admin can confirm the order' });
    }

    groupCart.isConfirmedByAdmin = true;
    await groupCart.save();

    req.io?.to(`group-${groupCart._id}`).emit('cart-updated', { groupCart });
    console.log('[GroupCart] confirmGroupOrder success', groupCart._id);
    res.json({ success: true, message: 'Order items confirmed! Payment access is now granted to members.', groupCart });
  } catch (error) {
    console.error('[GroupCart] confirmGroupOrder error', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteGroupCart = async (req, res) => {
  try {
    console.log('[GroupCart] deleteGroupCart called by', req.user._id, 'id', req.params.id);
    const groupCart = await GroupCart.findById(req.params.id);
    if (!groupCart) return res.status(404).json({ success: false, message: 'Group cart not found' });

    const isGroupAdmin = groupCart.admin.toString() === req.user._id.toString();
    const isSysAdmin   = req.user.role === 'admin';
    if (!isGroupAdmin && !isSysAdmin) {
      return res.status(403).json({ success: false, message: 'Only admin can delete the group cart' });
    }

    await GroupCart.findByIdAndDelete(req.params.id);
    req.io?.to(`group-${groupCart._id}`).emit('group-deleted', { groupCartId: groupCart._id });
    res.json({ success: true, message: 'Group cart deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllRegisteredUsers = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } }).select('email username avatar');
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const payMemberShare = async (req, res) => {
  try {
    const groupCart = await GroupCart.findById(req.params.id);
    if (!groupCart) return res.status(404).json({ success: false, message: 'Group cart not found' });

    const member = groupCart.members.find(m => 
      m.user?.toString() === req.user._id.toString() || m.email === req.user.email
    );
    if (!member) return res.status(403).json({ success: false, message: 'You are not a member of this group' });

    member.hasPaid = true;
    member.paymentAmount = groupCart.pricePerMember;

    const allPaid = groupCart.members.filter(m => m.status === 'accepted').every(m => m.hasPaid);
    if (allPaid) {
      groupCart.status = 'completed';
      groupCart.isActive = false;
      await groupCart.save();
      req.io?.to(`group-${groupCart._id}`).emit('order-confirmed', { groupCart });
    } else {
      await groupCart.save();
      req.io?.to(`group-${groupCart._id}`).emit('cart-updated', { groupCart });
    }

    res.json({ success: true, groupCart, message: 'Your share has been paid successfully!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getGroupMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const groupCart = await GroupCart.findById(id);
    if (!groupCart) {
      return res.status(404).json({ success: false, message: 'Group cart not found' });
    }

    const isMember = groupCart.members.some(
      m => m.user?.toString() === req.user._id.toString() || m.email === req.user.email
    );
    const isAdmin = groupCart.admin.toString() === req.user._id.toString();

    if (!isMember && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to view messages of this group' });
    }

    const messages = await GroupMessage.find({ groupCart: id })
      .populate('sender', '_id username email avatar')
      .sort({ createdAt: 1 });

    res.json({ success: true, messages });
  } catch (error) {
    console.error('[GroupCart] getGroupMessages error', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const { content } = req.body;
    const { id } = req.params;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    const groupCart = await GroupCart.findById(id);
    if (!groupCart) {
      return res.status(404).json({ success: false, message: 'Group cart not found' });
    }

    const isMember = groupCart.members.some(
      m => m.user?.toString() === req.user._id.toString() || m.email === req.user.email
    );
    const isAdmin = groupCart.admin.toString() === req.user._id.toString();

    if (!isMember && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to send messages to this group' });
    }

    const message = await GroupMessage.create({
      groupCart: id,
      sender: req.user._id,
      content
    });

    await message.populate('sender', '_id username email avatar');

    req.io?.to(`group-${id}`).emit('new-group-message', message);

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error('[GroupCart] sendGroupMessage error', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};