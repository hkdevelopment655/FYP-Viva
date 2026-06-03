import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

const formatUserResponse = (user) => {
  const isSocial = !!(user.googleId || user.facebookId);
  return {
    id: user._id,
    username: isSocial ? `${user.username} (${user.email})` : user.username,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    googleId: user.googleId,
    facebookId: user.facebookId
  };
};

export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (await User.findOne({ email })) return res.status(400).json({ success: false, message: 'Email already exists' });
    if (await User.findOne({ username })) return res.status(400).json({ success: false, message: 'Username taken' });

    // Check if the username is 'admin' (case-insensitive) and assign the role
    const role = username.toLowerCase() === 'admin' ? 'admin' : 'user';
    
    const user = await User.create({ username, email, password, role });
    // ...
    const token = generateToken(user._id);
    res.status(201).json({
      success: true,
      token,
      user: formatUserResponse(user)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Auto-create/login admin user
    if (email === 'admin@smartai.com' && password === 'admin123') {
      let adminUser = await User.findOne({ email });
      if (!adminUser) {
        adminUser = await User.create({
          username: 'Admin',
          email: 'admin@smartai.com',
          password: 'admin123',
          role: 'admin'
        });
      }
      const token = generateToken(adminUser._id);
      return res.json({
        success: true,
        token,
        user: formatUserResponse(adminUser)
      });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const token = generateToken(user._id);
    res.json({
      success: true,
      token,
      user: formatUserResponse(user)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMe = async (req, res) => {
  res.json({ success: true, user: formatUserResponse(req.user) });
};

export const updateProfile = async (req, res) => {
  try {
    const { username, preferences } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { username, preferences },
      { new: true, runValidators: true }
    );
    res.json({ success: true, user: formatUserResponse(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Admin accounts cannot be deleted here' });
    }

    await User.findByIdAndDelete(req.user._id);
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).json({ success: false, message: 'No user with that email' });

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    res.json({ success: true, message: 'Password reset email sent', resetToken }); // In production, send via email
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });
    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired token' });

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    const token = generateToken(user._id);
    res.json({ success: true, token, message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const socialLogin = async (req, res) => {
  try {
    const { provider, email, avatar, providerId } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required from social provider' });
    }
    
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `No account exists on Smart AI Platform with the email "${email}". Please register an account first before using social login.`
      });
    }

    // User exists, link account and update avatar if not present
    let updated = false;
    if (provider === 'google' && !user.googleId) {
      user.googleId = providerId;
      updated = true;
    } else if (provider === 'facebook' && !user.facebookId) {
      user.facebookId = providerId;
      updated = true;
    }
    
    if (!user.avatar && avatar) {
      user.avatar = avatar;
      updated = true;
    }
    if (updated) {
      await user.save();
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated' });
    }
    const token = generateToken(user._id);
    
    res.json({
      success: true,
      token,
      user: formatUserResponse(user)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
