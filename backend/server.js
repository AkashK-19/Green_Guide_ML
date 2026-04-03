require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer'); 

const Razorpay = require('razorpay');
const { GREENBOT_SYSTEM_PROMPT, buildDiseaseInsightPrompt } = require('./chatbotPrompt');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});
const crypto = require('crypto');
const app = express();

// --- EMAIL CONFIGURATION ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.ADMIN_EMAIL,
    pass: process.env.ADMIN_EMAIL_PASSWORD
  }
});

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email transporter error:', error);
  } else {
    console.log('✅ Email server is ready to send messages');
  }
});

// --- MULTER CONFIGURATION ---
const UPLOADS_DIR = path.join(__dirname, 'uploads'); 

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use('/uploads', express.static(UPLOADS_DIR)); 

// --- MONGODB CONNECTION ---
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/greenguide', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.log('❌ MongoDB Error:', err));

// ==================== SCHEMAS ====================

// Subscription Schema
const subscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  planType: { type: String, required: true, enum: ['weekly', 'monthly', 'yearly'] },
  status: { type: String, default: 'active', enum: ['active', 'expired', 'cancelled'] },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, required: true },
  amount: { type: Number, required: true },
  paymentId: { type: String },
  autoRenew: { type: Boolean, default: false }
}, { timestamps: true });

// Index for faster queries
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ endDate: 1, status: 1 });

const Subscription = mongoose.model('Subscription', subscriptionSchema);

// User Schema (Updated with subscription info)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  profile: {
    bio: { type: String, default: "" },
    location: { type: String, default: "" },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Plant' }],
    badgesEarned: { type: [String], default: ["New Member"] },
    carbonOffset: { type: Number, default: 0 },
    treesPlanted: { type: Number, default: 0 }
  },
  subscription: {
    isActive: { type: Boolean, default: false },
    planType: { type: String, enum: ['weekly', 'monthly', 'yearly', null], default: null },
    endDate: { type: Date, default: null }
  }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

const plantSchema = new mongoose.Schema({
  title: { type: String, required: true },
  scientific: { type: String, required: true },
  category: String,
  description: { type: String, required: true },
  region: String,
  season: String,
  plantType: String,
  healthBenefits: [String],
  images: [{
    src: String,
    alt: String
  }],
  status: { type: String, default: 'draft', enum: ['draft', 'published', 'archived'] },
  medicinalUses: [{
    icon: String,
    title: String,
    description: String
  }],
  growingSteps: [{
    icon: String,
    title: String,
    description: String,
    tips: String
  }],
  traditionalUses: [String],
  seasonalCare: {
    spring: [String],
    summer: [String],
    monsoon: [String],
    winter: [String]
  },
  quickFacts: {
    family: String,
    nativeRegion: String,
    lifespan: String,
    harvestTime: String,
    sunRequirement: String,
    waterNeeds: String,
    soilType: String,
    propagation: String
  },
  ayurvedicProperties: {
    rasa: String,
    virya: String,
    vipaka: String,
    dosha: String
  },
  translations: {
    en: {
      title: String,
      scientific: String,
      description: String,
      region: String,
      season: String,
      plantType: String
    },
    mr: {
      title: String,
      scientific: String,
      description: String,
      region: String,
      season: String,
      plantType: String
    }
  }
}, { timestamps: true });

const Plant = mongoose.model('Plant', plantSchema);

const contactInfoSchema = new mongoose.Schema({
  location: {
    title: { type: String, default: 'Our Location' },
    details: { type: [String], default: [] }
  },
  phone: {
    title: { type: String, default: 'Phone Numbers' },
    details: { type: [String], default: [] }
  },
  email: {
    title: { type: String, default: 'Email Addresses' },
    details: { type: [String], default: [] }
  },
  hours: {
    title: { type: String, default: 'Business Hours' },
    details: { type: [String], default: [] }
  }
}, { timestamps: true });

const ContactInfo = mongoose.model('ContactInfo', contactInfoSchema);

const pricingSchema = new mongoose.Schema({
  weekly: {
    price: { type: Number, default: 0 },
    originalPrice: { type: Number, default: 0 },
    discount: { type: Number, default: 0 }
  },
  monthly: {
    price: { type: Number, default: 0 },
    originalPrice: { type: Number, default: 0 },
    discount: { type: Number, default: 0 }
  },
  yearly: {
    price: { type: Number, default: 0 },
    originalPrice: { type: Number, default: 0 },
    discount: { type: Number, default: 0 }
  }
}, { timestamps: true });

const Pricing = mongoose.model('Pricing', pricingSchema);

// --- HELPER FUNCTIONS ---
const getUserResponse = (user) => {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    profile: {
      bio: user.profile.bio,
      location: user.profile.location,
      favorites: user.profile.favorites || [],
      badgesEarned: user.profile.badgesEarned,
      carbonOffset: user.profile.carbonOffset,
      treesPlanted: user.profile.treesPlanted
    },
    subscription: {
      isActive: user.subscription.isActive,
      planType: user.subscription.planType,
      endDate: user.subscription.endDate
    }
  };
};

// Calculate end date based on plan type
const calculateEndDate = (planType) => {
  const now = new Date();
  switch(planType) {
    case 'weekly':
      return new Date(now.setDate(now.getDate() + 7));
    case 'monthly':
      return new Date(now.setMonth(now.getMonth() + 1));
    case 'yearly':
      return new Date(now.setFullYear(now.getFullYear() + 1));
    default:
      return new Date(now.setDate(now.getDate() + 7));
  }
};

// Background job to check and expire subscriptions
const checkExpiredSubscriptions = async () => {
  try {
    const now = new Date();
    
    // Find all active subscriptions that have expired
    const expiredSubscriptions = await Subscription.find({
      status: 'active',
      endDate: { $lte: now }
    });

    for (const subscription of expiredSubscriptions) {
      // Update subscription status
      subscription.status = 'expired';
      await subscription.save();

      // Update user subscription status
      const user = await User.findById(subscription.userId);
      if (user) {
        user.subscription.isActive = false;
        user.subscription.planType = null;
        user.subscription.endDate = null;
        await user.save();

        // Send expiration email
        try {
          await transporter.sendMail({
            from: `"GreenGuide" <${process.env.ADMIN_EMAIL}>`,
            to: user.email,
            subject: 'Your GreenGuide Subscription Has Expired 🌿',
            html: `
              <!DOCTYPE html>
              <html>
              <body style="font-family: Arial, sans-serif;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #16a34a;">Subscription Expired</h2>
                  <p>Hi ${user.name},</p>
                  <p>Your ${subscription.planType} subscription has expired on ${subscription.endDate.toLocaleDateString()}.</p>
                  <p>Renew now to continue accessing premium features!</p>
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscribe" 
                     style="display: inline-block; padding: 12px 30px; background: #16a34a; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px;">
                    Renew Subscription
                  </a>
                </div>
              </body>
              </html>
            `
          });
        } catch (emailError) {
          console.error('Error sending expiration email:', emailError);
        }
      }
    }

    if (expiredSubscriptions.length > 0) {
      console.log(`✅ Expired ${expiredSubscriptions.length} subscriptions`);
    }
  } catch (error) {
    console.error('Error checking expired subscriptions:', error);
  }
};

// Run subscription check every hour
setInterval(checkExpiredSubscriptions, 60 * 60 * 1000);

// Run once on startup
checkExpiredSubscriptions();

// ==================== AUTHENTICATION ROUTES ====================

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Please enter all fields' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const newUser = new User({ name, email, password });
    const savedUser = await newUser.save();

    res.status(201).json({
      success: true,
      user: getUserResponse(savedUser),
      message: 'Registration successful. Welcome!'
    });
  } catch (error) {
    console.error('Sign-up error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please enter both email and password' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if subscription has expired
    if (user.subscription.isActive && user.subscription.endDate && new Date() > user.subscription.endDate) {
      user.subscription.isActive = false;
      user.subscription.planType = null;
      user.subscription.endDate = null;
      await user.save();
    }

    res.status(200).json({
      success: true,
      user: getUserResponse(user),
      message: 'Authentication successful'
    });
  } catch (error) {
    console.error('Sign-in error:', error);
    res.status(500).json({ message: 'Server error during authentication' });
  }
});

// ==================== SUBSCRIPTION ROUTES ====================

// Get subscription status
app.get('/api/subscription/status/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if subscription has expired
    if (user.subscription.isActive && user.subscription.endDate && new Date() > user.subscription.endDate) {
      user.subscription.isActive = false;
      user.subscription.planType = null;
      user.subscription.endDate = null;
      await user.save();
    }

    res.json({
      success: true,
      subscription: user.subscription
    });
  } catch (error) {
    console.error('Get subscription status error:', error);
    res.status(500).json({ message: 'Server error fetching subscription status' });
  }
});

// Create subscription (purchase)
app.post('/api/subscription/create', async (req, res) => {
  try {
    const { userId, planType, paymentId } = req.body;

    if (!userId || !planType) {
      return res.status(400).json({ message: 'User ID and plan type are required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get pricing
    const pricing = await Pricing.findOne();
    if (!pricing || !pricing[planType]) {
      return res.status(404).json({ message: 'Pricing not found for this plan' });
    }

    const amount = pricing[planType].price;
    const endDate = calculateEndDate(planType);

    // Create subscription record
    const subscription = new Subscription({
      userId,
      planType,
      status: 'active',
      startDate: new Date(),
      endDate,
      amount,
      paymentId: paymentId || `MOCK_${Date.now()}`
    });

    await subscription.save();

    // Update user subscription status
    user.subscription.isActive = true;
    user.subscription.planType = planType;
    user.subscription.endDate = endDate;
    await user.save();

    // Send confirmation email
    try {
      await transporter.sendMail({
        from: `"GreenGuide" <${process.env.ADMIN_EMAIL}>`,
        to: user.email,
        subject: 'Welcome to GreenGuide Premium! 🌿',
        html: `
          <!DOCTYPE html>
          <html>
          <body style="font-family: Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
              <div style="background: linear-gradient(135deg, #16a34a, #22c55e); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1>Welcome to Premium!</h1>
              </div>
              <div style="background: white; padding: 30px; border: 1px solid #ddd;">
                <p>Hi ${user.name},</p>
                <p>Thank you for subscribing to GreenGuide Premium!</p>
                <div style="background: #f0fdf4; padding: 20px; border-left: 4px solid #16a34a; margin: 20px 0;">
                  <h3 style="margin: 0 0 10px 0;">Subscription Details:</h3>
                  <p style="margin: 5px 0;"><strong>Plan:</strong> ${planType.charAt(0).toUpperCase() + planType.slice(1)}</p>
                  <p style="margin: 5px 0;"><strong>Amount:</strong> ₹${amount}</p>
                  <p style="margin: 5px 0;"><strong>Valid Until:</strong> ${endDate.toLocaleDateString()}</p>
                </div>
                <p>You now have access to:</p>
                <ul>
                  <li>Complete plant encyclopedia</li>
                  <li>Expert growing guides</li>
                  <li>Ayurvedic properties database</li>
                  <li>Seasonal care calendars</li>
                  <li>And much more!</li>
                </ul>
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/plants" 
                     style="display: inline-block; padding: 12px 30px; background: #16a34a; color: white; text-decoration: none; border-radius: 5px;">
                    Start Exploring
                  </a>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      });
    } catch (emailError) {
      console.error('Error sending subscription email:', emailError);
    }

    res.status(201).json({
      success: true,
      subscription: {
        id: subscription._id,
        planType: subscription.planType,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        amount: subscription.amount
      },
      user: getUserResponse(user),
      message: 'Subscription activated successfully!'
    });
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({ message: 'Server error creating subscription' });
  }
});

// Cancel subscription
app.post('/api/subscription/cancel/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find active subscription
    const subscription = await Subscription.findOne({
      userId: req.params.userId,
      status: 'active'
    });

    if (subscription) {
      subscription.status = 'cancelled';
      await subscription.save();
    }

    // Update user
    user.subscription.isActive = false;
    user.subscription.planType = null;
    user.subscription.endDate = null;
    await user.save();

    res.json({
      success: true,
      message: 'Subscription cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ message: 'Server error cancelling subscription' });
  }
});

// Get subscription history
app.get('/api/subscription/history/:userId', async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ 
      userId: req.params.userId 
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      subscriptions
    });
  } catch (error) {
    console.error('Get subscription history error:', error);
    res.status(500).json({ message: 'Server error fetching subscription history' });
  }
});

// Create Razorpay order
app.post('/api/subscription/create-order', async (req, res) => {
  try {
    const { userId, planType, amount } = req.body;

    if (!userId || !planType || !amount) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create Razorpay order
    const options = {
      amount: amount * 100,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: {
        userId: userId,
        planType: planType
      }
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Failed to create order' });
  }
});

// Verify Razorpay payment and create subscription
app.post('/api/subscription/verify-payment', async (req, res) => {
  try {
    const { 
      userId, 
      planType, 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature 
    } = req.body;

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment verification failed' 
      });
    }

    // Get pricing
    const pricing = await Pricing.findOne();
    if (!pricing || !pricing[planType]) {
      return res.status(404).json({ message: 'Pricing not found' });
    }

    const amount = pricing[planType].price;
    const endDate = calculateEndDate(planType);

    // Create subscription record
    const subscription = new Subscription({
      userId,
      planType,
      status: 'active',
      startDate: new Date(),
      endDate,
      amount,
      paymentId: razorpay_payment_id
    });

    await subscription.save();

    // Update user
    const user = await User.findById(userId);
    user.subscription.isActive = true;
    user.subscription.planType = planType;
    user.subscription.endDate = endDate;
    await user.save();

    // Send confirmation email
    try {
      await transporter.sendMail({
        from: `"GreenGuide" <${process.env.ADMIN_EMAIL}>`,
        to: user.email,
        subject: 'Welcome to GreenGuide Premium! 🌿',
        html: `
          <!DOCTYPE html>
          <html>
          <body style="font-family: Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
              <div style="background: linear-gradient(135deg, #16a34a, #22c55e); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1>Welcome to Premium!</h1>
              </div>
              <div style="background: white; padding: 30px; border: 1px solid #ddd;">
                <p>Hi ${user.name},</p>
                <p>Thank you for subscribing to GreenGuide Premium!</p>
                <div style="background: #f0fdf4; padding: 20px; border-left: 4px solid #16a34a; margin: 20px 0;">
                  <h3 style="margin: 0 0 10px 0;">Subscription Details:</h3>
                  <p style="margin: 5px 0;"><strong>Plan:</strong> ${planType.charAt(0).toUpperCase() + planType.slice(1)}</p>
                  <p style="margin: 5px 0;"><strong>Amount:</strong> ₹${amount}</p>
                  <p style="margin: 5px 0;"><strong>Payment ID:</strong> ${razorpay_payment_id}</p>
                  <p style="margin: 5px 0;"><strong>Valid Until:</strong> ${endDate.toLocaleDateString()}</p>
                </div>
                <p>You now have access to all premium features!</p>
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/plants" 
                     style="display: inline-block; padding: 12px 30px; background: #16a34a; color: white; text-decoration: none; border-radius: 5px;">
                    Start Exploring
                  </a>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      });
    } catch (emailError) {
      console.error('Error sending subscription email:', emailError);
    }

    res.json({
      success: true,
      message: 'Payment verified and subscription activated',
      user: getUserResponse(user),
      subscription: {
        id: subscription._id,
        planType: subscription.planType,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        amount: subscription.amount
      }
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ message: 'Payment verification failed' });
  }
});

// ==================== USER FAVORITES ROUTES ====================

app.get('/api/user/favorites/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const favoriteIds = (user.profile.favorites || []).map(id => id.toString());
    res.json({ favorites: favoriteIds });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ message: 'Server error fetching favorites' });
  }
});

app.get('/api/user/favorites/:userId/plants', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).populate('profile.favorites');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const favoritePlants = (user.profile.favorites || []).filter(plant => plant !== null);
    const publishedFavorites = favoritePlants.filter(plant => plant.status === 'published');

    res.json({ 
      success: true,
      favorites: publishedFavorites,
      count: publishedFavorites.length
    });
  } catch (error) {
    console.error('Get favorite plants error:', error);
    res.status(500).json({ message: 'Server error fetching favorite plants' });
  }
});

app.put('/api/user/favorites/:userId', async (req, res) => {
  try {
    const { favorites } = req.body;
    
    if (!Array.isArray(favorites)) {
      return res.status(400).json({ message: 'Favorites must be an array' });
    }

    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const validPlantIds = favorites.filter(plantId => mongoose.Types.ObjectId.isValid(plantId));

    const existingPlants = await Plant.find({
      '_id': { $in: validPlantIds },
      'status': 'published' 
    });
    const finalValidIds = existingPlants.map(p => p._id);

    user.profile.favorites = finalValidIds;
    await user.save();

    const favoriteIds = finalValidIds.map(id => id.toString());
    res.json({ 
      success: true,
      favorites: favoriteIds,
      message: 'Favorites updated successfully'
    });
  } catch (error) {
    console.error('Update favorites error:', error);
    res.status(500).json({ message: 'Server error updating favorites' });
  }
});

app.post('/api/user/favorites/:userId', async (req, res) => {
  try {
    const { plantId } = req.body;
    
    if (!plantId) {
      return res.status(400).json({ message: 'Plant ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(plantId)) {
      return res.status(400).json({ message: 'Invalid Plant ID format' });
    }

    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const plant = await Plant.findOne({ _id: plantId, status: 'published' });
    if (!plant) {
      return res.status(404).json({ message: 'Plant not found or not published' });
    }

    if (!user.profile.favorites) {
      user.profile.favorites = [];
    }

    const plantObjectId = new mongoose.Types.ObjectId(plantId);
    const alreadyFavorited = user.profile.favorites.some(
      fav => fav.toString() === plantObjectId.toString()
    );

    if (!alreadyFavorited) {
      user.profile.favorites.push(plantObjectId);
      await user.save();
    }

    const favoriteIds = user.profile.favorites.map(id => id.toString());
    res.json({ 
      success: true,
      favorites: favoriteIds,
      message: 'Plant added to favorites'
    });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({ message: 'Server error adding favorite' });
  }
});

app.delete('/api/user/favorites/:userId', async (req, res) => {
  try {
    const { plantId } = req.body;
    
    if (!plantId) {
      return res.status(400).json({ message: 'Plant ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(plantId)) {
      return res.status(400).json({ message: 'Invalid Plant ID format' });
    }

    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.profile.favorites) {
      const plantObjectId = new mongoose.Types.ObjectId(plantId);
      user.profile.favorites = user.profile.favorites.filter(
        fav => fav.toString() !== plantObjectId.toString()
      );
      await user.save();
    }

    const favoriteIds = (user.profile.favorites || []).map(id => id.toString());
    res.json({ 
      success: true,
      favorites: favoriteIds,
      message: 'Plant removed from favorites'
    });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ message: 'Server error removing favorite' });
  }
});

// ==================== ADMIN ROUTES ====================

app.post('/api/admin/upload-image', upload.array('images', 5), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: 'No files uploaded' });
  }

  const uploadedImages = req.files.map(file => ({
    src: `/uploads/${file.filename}`, 
    alt: file.originalname.split('.')[0] 
  }));

  res.status(200).json({ 
    message: 'Images uploaded successfully', 
    images: uploadedImages 
  });
});

app.get('/api/admin/plants', async (req, res) => {
  try {
    const plants = await Plant.find().sort({ createdAt: -1 });
    res.json(plants);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/admin/plants/:id', async (req, res) => {
  try {
    const plant = await Plant.findById(req.params.id);
    if (!plant) {
      return res.status(404).json({ message: 'Plant not found' });
    }
    res.json(plant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/admin/plants', async (req, res) => {
  try {
    const plant = new Plant(req.body);
    const savedPlant = await plant.save();
    res.status(201).json(savedPlant);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.put('/api/admin/plants/:id', async (req, res) => {
  try {
    const plant = await Plant.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!plant) {
      return res.status(404).json({ message: 'Plant not found' });
    }
    res.json(plant);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/admin/plants/:id', async (req, res) => {
  try {
    const plant = await Plant.findByIdAndDelete(req.params.id);
    if (!plant) {
      return res.status(404).json({ message: 'Plant not found' });
    }
    res.json({ message: 'Plant deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/admin/contact', async (req, res) => {
  try {
    let contactInfo = await ContactInfo.findOne();
    if (!contactInfo) {
      contactInfo = new ContactInfo({
        location: { title: 'Our Location', details: [] },
        phone: { title: 'Phone Numbers', details: [] },
        email: { title: 'Email Addresses', details: [] },
        hours: { title: 'Business Hours', details: [] }
      });
      await contactInfo.save();
    }
    res.json(contactInfo);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/admin/contact', async (req, res) => {
  try {
    let contactInfo = await ContactInfo.findOne();
    
    if (!contactInfo) {
      contactInfo = new ContactInfo(req.body);
    } else {
      if (req.body.location) {
        contactInfo.location = {
          title: req.body.location.title || contactInfo.location.title,
          details: req.body.location.details || contactInfo.location.details
        };
      }
      if (req.body.phone) {
        contactInfo.phone = {
          title: req.body.phone.title || contactInfo.phone.title,
          details: req.body.phone.details || contactInfo.phone.details
        };
      }
      if (req.body.email) {
        contactInfo.email = {
          title: req.body.email.title || contactInfo.email.title,
          details: req.body.email.details || contactInfo.email.details
        };
      }
      if (req.body.hours) {
        contactInfo.hours = {
          title: req.body.hours.title || contactInfo.hours.title,
          details: req.body.hours.details || contactInfo.hours.details
        };
      }
    }
    
    await contactInfo.save();
    res.json(contactInfo);
  } catch (error) {
    console.error('Error saving contact info:', error);
    res.status(400).json({ message: error.message });
  }
});

app.get('/api/admin/pricing', async (req, res) => {
  try {
    let pricing = await Pricing.findOne();
    if (!pricing) {
      pricing = new Pricing();
      await pricing.save();
    }
    res.json(pricing);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/admin/pricing', async (req, res) => {
  try {
    let pricing = await Pricing.findOne();
    if (!pricing) {
      pricing = new Pricing(req.body);
    } else {
      Object.assign(pricing, req.body);
    }
    await pricing.save();
    res.json(pricing);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Admin: Get all subscriptions
app.get('/api/admin/subscriptions', async (req, res) => {
  try {
    const subscriptions = await Subscription.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      subscriptions
    });
  } catch (error) {
    console.error('Get all subscriptions error:', error);
    res.status(500).json({ message: 'Server error fetching subscriptions' });
  }
});

// Admin: Get subscription statistics
app.get('/api/admin/subscription-stats', async (req, res) => {
  try {
    const totalActive = await Subscription.countDocuments({ status: 'active' });
    const totalExpired = await Subscription.countDocuments({ status: 'expired' });
    const totalCancelled = await Subscription.countDocuments({ status: 'cancelled' });
    
    const weeklyActive = await Subscription.countDocuments({ status: 'active', planType: 'weekly' });
    const monthlyActive = await Subscription.countDocuments({ status: 'active', planType: 'monthly' });
    const yearlyActive = await Subscription.countDocuments({ status: 'active', planType: 'yearly' });
    
    const totalRevenue = await Subscription.aggregate([
      { $match: { status: { $in: ['active', 'expired'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.json({
      success: true,
      stats: {
        total: {
          active: totalActive,
          expired: totalExpired,
          cancelled: totalCancelled
        },
        byPlan: {
          weekly: weeklyActive,
          monthly: monthlyActive,
          yearly: yearlyActive
        },
        revenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0
      }
    });
  } catch (error) {
    console.error('Get subscription stats error:', error);
    res.status(500).json({ message: 'Server error fetching subscription statistics' });
  }
});

// ==================== CLIENT/PUBLIC ROUTES ====================

app.get('/api/plants', async (req, res) => {
  try {
    const { category, search, limit } = req.query;
    
    let query = { status: 'published' };
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { scientific: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    let plantsQuery = Plant.find(query).sort({ createdAt: -1 });
    
    if (limit) {
      plantsQuery = plantsQuery.limit(parseInt(limit));
    }
    
    const plants = await plantsQuery;
    res.json(plants);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/plants/:id', async (req, res) => {
  try {
    const plant = await Plant.findOne({ 
      _id: req.params.id, 
      status: 'published' 
    });
    
    if (!plant) {
      return res.status(404).json({ message: 'Plant not found' });
    }
    
    res.json(plant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Plant.distinct('category', { status: 'published' });
    res.json(categories.filter(cat => cat));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/contact', async (req, res) => {
  try {
    const contactInfo = await ContactInfo.findOne();
    if (!contactInfo) {
      const defaultInfo = new ContactInfo({
        location: { title: 'Our Location', details: ['Default Address Line 1', 'Default Address Line 2'] },
        phone: { title: 'Phone Numbers', details: ['+91 99999 88888'] },
        email: { title: 'Email Addresses', details: ['info@greenguide.in'] },
        hours: { title: 'Business Hours', details: ['Mon-Fri: 9am - 5pm'] }
      });
      await defaultInfo.save();
      return res.json(defaultInfo);
    }
    res.json(contactInfo);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/contact', upload.array('images', 5), async (req, res) => {
  const { firstName, lastName, email, phone, message } = req.body;
  const files = req.files;

  if (!firstName || !lastName || !email || !message) {
    if (files) {
      files.forEach(file => fs.unlink(file.path, (err) => {
        if (err) console.error('Failed to delete file after validation error:', err);
      }));
    }
    return res.status(400).json({ 
      success: false, 
      message: 'Missing required fields: first name, last name, email, and message.' 
    });
  }

  try {
    const attachments = files ? files.map(file => ({
      filename: file.originalname,
      path: file.path
    })) : [];

    const adminEmailOptions = {
      from: `"GreenGuide Contact Form" <${process.env.ADMIN_EMAIL}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `New Contact Form Message from ${firstName} ${lastName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #16a34a, #22c55e); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
            .field { margin-bottom: 15px; }
            .label { font-weight: bold; color: #16a34a; }
            .value { margin-top: 5px; padding: 10px; background: white; border-left: 3px solid #16a34a; }
            .footer { background: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 10px 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>🌿 New Contact Form Submission</h2>
            </div>
            <div class="content">
              <div class="field">
                <div class="label">Name:</div>
                <div class="value">${firstName} ${lastName}</div>
              </div>
              <div class="field">
                <div class="label">Email:</div>
                <div class="value"><a href="mailto:${email}">${email}</a></div>
              </div>
              <div class="field">
                <div class="label">Phone:</div>
                <div class="value">${phone || 'Not provided'}</div>
              </div>
              <div class="field">
                <div class="label">Message:</div>
                <div class="value">${message.replace(/\n/g, '<br>')}</div>
              </div>
              ${files && files.length > 0 ? `
              <div class="field">
                <div class="label">Attachments:</div>
                <div class="value">${files.length} file(s) attached</div>
              </div>
              ` : ''}
            </div>
            <div class="footer">
              <p>This message was sent via the GreenGuide contact form</p>
              <p>Received on ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
            </div>
          </div>
        </body>
        </html>
      `,
      attachments: attachments
    };

    const userEmailOptions = {
      from: `"GreenGuide" <${process.env.ADMIN_EMAIL}>`,
      to: email,
      subject: 'Thank you for contacting GreenGuide! 🌿',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #16a34a, #22c55e); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
            .message-box { background: white; padding: 20px; border-left: 4px solid #16a34a; margin: 20px 0; }
            .footer { background: #f0f0f0; padding: 20px; text-align: center; font-size: 13px; color: #666; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #16a34a; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🌿 Thank You, ${firstName}!</h1>
              <p>We've received your message</p>
            </div>
            <div class="content">
              <p>Dear ${firstName} ${lastName},</p>
              <p>Thank you for reaching out to GreenGuide! We've successfully received your message and one of our team members will get back to you within 24 hours.</p>
              
              <div class="message-box">
                <strong>Your Message:</strong>
                <p style="margin-top: 10px;">${message.replace(/\n/g, '<br>')}</p>
              </div>

              <p>In the meantime, feel free to explore our plant database and learn more about medicinal plants!</p>
              
              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/plants" class="button">Explore Plants</a>
              </div>
            </div>
            <div class="footer">
              <p><strong>GreenGuide - Your Natural Healing Companion</strong></p>
              <p>If you have any urgent queries, please call us directly.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(adminEmailOptions);
    await transporter.sendMail(userEmailOptions);

    console.log('✅ Emails sent successfully to admin and user');

    res.status(200).json({ 
      success: true, 
      message: 'Message sent successfully! Check your email for confirmation.' 
    });

  } catch (error) {
    console.error('❌ Error sending email:', error);
    
    if (files) {
      files.forEach(file => fs.unlink(file.path, (err) => {
        if (err) console.error('Failed to delete file after email error:', err);
      }));
    }

    res.status(500).json({ 
      success: false,
      message: 'Failed to send message. Please try again later or contact us directly.' 
    });
  }
});

app.get('/api/pricing', async (req, res) => {
  try {
    const pricing = await Pricing.findOne();
    if (!pricing) {
      return res.status(404).json({ message: 'Pricing not found' });
    }
    res.json(pricing);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// ==================== ML ROUTES ====================

const ML_SERVER_URL = process.env.ML_SERVER_URL || 'http://localhost:5001';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// ── Schemas ───────────────────────────────────────────────────────────────────

const chatHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  sessionId: { type: String, required: true },
  messages: [
    {
      role: { type: String, enum: ['user', 'model'], required: true },
      text: { type: String, required: true },
      timestamp: { type: Date, default: Date.now }
    }
  ]
}, { timestamps: true });

const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);

const diseaseDetectionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  imagePath: { type: String },
  disease: { type: String },
  confidence: { type: Number },
  info: { type: String },
  allPredictions: [{ disease: String, confidence: Number }]
}, { timestamps: true });

const DiseaseDetection = mongoose.model('DiseaseDetection', diseaseDetectionSchema);

// ── Feature 1: AI Chatbot (Gemini) ───────────────────────────────────────────

app.post('/api/chat', async (req, res) => {
  const { message, sessionId, userId } = req.body;

  if (!message || !sessionId) {
    return res.status(400).json({
      success: false,
      message: 'message and sessionId are required'
    });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({
      success: false,
      message: 'GEMINI_API_KEY is not configured in .env'
    });
  }

  try {
    let session = await ChatHistory.findOne({ sessionId });

    if (!session) {
      session = new ChatHistory({
        sessionId,
        userId: userId || undefined,
        messages: []
      });
    }

    const geminiHistory = session.messages.map((m) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.text }]
    }));

    const systemInstruction = GREENBOT_SYSTEM_PROMPT;

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const geminiPayload = {
      system_instruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [
        ...geminiHistory,
        { role: 'user', parts: [{ text: message }] }
      ],
      generationConfig: {
        maxOutputTokens: 600,
        temperature: 0.7,
        topP: 0.95,
        topK: 40
      }
    };

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload)
    });

    const rawText = await geminiRes.text();
    let geminiData = {};

    try {
      geminiData = rawText ? JSON.parse(rawText) : {};
    } catch (parseError) {
      console.error('Gemini parse error:', parseError);
      console.error('Gemini raw response:', rawText);
      return res.status(502).json({
        success: false,
        message: 'AI service temporarily unavailable.'
      });
    }

    if (!geminiRes.ok) {
      console.error('Gemini API error status:', geminiRes.status);
      console.error('Gemini API error body:', geminiData);
      return res.status(502).json({
        success: false,
        message: 'AI service temporarily unavailable.'
      });
    }

    const reply =
      geminiData?.candidates?.[0]?.content?.parts
        ?.map((part) => part?.text || '')
        .join('')
        .trim() ||
      'Sorry, I could not generate a response right now.';

    session.messages.push({ role: 'user', text: message });
    session.messages.push({ role: 'model', text: reply });
    await session.save();

    res.json({
      success: true,
      reply,
      sessionId
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({
      success: false,
      message: 'Chat service error.'
    });
  }
});

app.get('/api/chat/:sessionId', async (req, res) => {
  try {
    const session = await ChatHistory.findOne({ sessionId: req.params.sessionId });
    res.json({ success: true, messages: session ? session.messages : [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Feature 2: Disease Detection (ML model on port 5001) ─────────────────────

app.post('/api/disease-detect', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload an image.' });
  }

  try {
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');

    const mlRes = await fetch(`${ML_SERVER_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image })
    });

    if (!mlRes.ok) {
      console.error('ML server error:', await mlRes.text());
      return res.status(502).json({
        success: false,
        message: 'ML model error. Run: cd backend/ml_server && python app.py'
      });
    }

    const mlData = await mlRes.json();

    if (mlData.error) {
      return res.status(422).json({ success: false, message: mlData.error });
    }

    const detection = new DiseaseDetection({
      userId: req.body.userId || undefined,
      imagePath: `/uploads/${req.file.filename}`,
      disease: mlData.disease,
      confidence: mlData.confidence,
      info: mlData.info,
      allPredictions: mlData.all_predictions
    });
    await detection.save();

    res.json({
      success: true,
      disease: mlData.disease,
      confidence: mlData.confidence,
      info: mlData.info,
      allPredictions: mlData.all_predictions,
      imagePath: `/uploads/${req.file.filename}`,
      detectionId: detection._id
    });
  } catch (err) {
    console.error('Disease detection error:', err);
    res.status(500).json({ success: false, message: 'Disease detection failed: ' + err.message });
  }
});

app.get('/api/disease-detect/history/:userId', async (req, res) => {
  try {
    const results = await DiseaseDetection.find({ userId: req.params.userId })
      .sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Feature 3: Plant Identification (ML model on port 5002) ──────────────────

const PLANT_ML_SERVER_URL = process.env.PLANT_ML_SERVER_URL || 'http://localhost:5002';

app.post('/api/plant-identify', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload an image.' });
  }

  try {
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(req.file.path);
    const blob = new Blob([fileBuffer], { type: req.file.mimetype });
    formData.append('image', blob, req.file.originalname);

    const mlRes = await fetch(`${PLANT_ML_SERVER_URL}/predict`, {
      method: 'POST',
      body: formData
    });

    if (!mlRes.ok) {
      return res.status(502).json({
        success: false,
        message: 'Plant ML model error. Run: cd backend/plant_server && python app.py'
      });
    }

    const mlData = await mlRes.json();

    if (mlData.error) {
      return res.status(422).json({ success: false, message: mlData.error });
    }

    res.json({
      success: true,
      plant: mlData.plant,
      confidence: mlData.confidence,
      top3: mlData.top3,
      message: mlData.message,
      imagePath: `/uploads/${req.file.filename}`
    });
  } catch (err) {
    console.error('Plant identification error:', err);
    res.status(500).json({ success: false, message: 'Plant identification failed: ' + err.message });
  }
});

// ── Disease AI Insight route ──────────────────────────────────────────────────
app.post('/api/disease-insight', async (req, res) => {
  const { disease } = req.body;
  if (!disease || disease === 'healthy') {
    return res.json({ success: true, insight: null });
  }
  try {
    const prompt = buildDiseaseInsightPrompt(disease);
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 300, temperature: 0.3 }
      })
    });
    const rawText = await geminiRes.text();
    let geminiData = {};
    try { geminiData = rawText ? JSON.parse(rawText) : {}; } catch (_) {}
    const insight = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || null;
    res.json({ success: true, insight });
  } catch (err) {
    console.error('Disease insight error:', err);
    res.json({ success: false, insight: null });
  }
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('🚀 Server running on port ' + PORT);
});