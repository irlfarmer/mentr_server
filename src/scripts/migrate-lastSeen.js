const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mentr', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Import the User model
const User = require('../models/User').default;

async function migrateLastSeen() {
  try {
    console.log('Starting lastSeen migration...');
    
    // Find users without lastSeen field
    const usersWithoutLastSeen = await User.find({
      $or: [
        { lastSeen: { $exists: false } },
        { lastSeen: null }
      ]
    });

    console.log(`Found ${usersWithoutLastSeen.length} users without lastSeen`);

    // Update each user with a default lastSeen value
    for (const user of usersWithoutLastSeen) {
      await User.findByIdAndUpdate(user._id, {
        lastSeen: new Date()
      });
      console.log(`Updated lastSeen for user: ${user._id}`);
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    mongoose.connection.close();
  }
}

migrateLastSeen();
