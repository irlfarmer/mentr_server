const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const { User } = require('./dist/models/User');
const { ReferralCode } = require('./dist/models/ReferralCode');

async function createTestReferralCode() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mentr-marketplace');
    console.log('Connected to MongoDB');

    // Find the user you just created
    const user = await User.findOne({ email: 'kola_e_r@proton.me' });
    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('Found user:', user.firstName, user.lastName);

    // Generate a referral code for this user
    const referralCode = new ReferralCode({
      userId: user._id,
      code: 'KRY1234', // Simple test code
      isActive: true,
      totalUses: 0
    });

    await referralCode.save();
    console.log('Created referral code:', referralCode.code);
    console.log('Referral link: http://localhost:3000/register?ref=' + referralCode.code);

    // Test the referral code
    console.log('\nTo test:');
    console.log('1. Go to: http://localhost:3000/register?ref=' + referralCode.code);
    console.log('2. Sign up with a different email');
    console.log('3. Check the database for a new Referral document');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createTestReferralCode();
