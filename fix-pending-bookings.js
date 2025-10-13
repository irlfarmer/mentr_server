const mongoose = require('mongoose');
require('dotenv').config();

// Import your Booking model
const { Booking } = require('./dist/src/models/Booking');

async function fixPendingBookings() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all bookings that are paid but still pending
    const problematicBookings = await Booking.find({
      paymentStatus: 'paid',
      status: 'pending'
    });

    console.log(`Found ${problematicBookings.length} bookings with paymentStatus='paid' but status='pending'`);

    if (problematicBookings.length === 0) {
      console.log('No problematic bookings found!');
      return;
    }

    // Update each booking
    for (const booking of problematicBookings) {
      console.log(`Fixing booking ${booking._id}...`);
      
      booking.status = 'confirmed';
      await booking.save();
      
      console.log(`✅ Updated booking ${booking._id} status to 'confirmed'`);
    }

    console.log(`\n🎉 Successfully fixed ${problematicBookings.length} bookings!`);
    
    // Verify the fix
    const remainingProblematic = await Booking.find({
      paymentStatus: 'paid',
      status: 'pending'
    });
    
    console.log(`\nVerification: ${remainingProblematic.length} bookings still have the issue`);
    
  } catch (error) {
    console.error('Error fixing bookings:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the fix
fixPendingBookings();
