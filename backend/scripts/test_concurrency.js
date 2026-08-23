import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Seat from '../models/Seat.js';
import Show from '../models/Show.js';
import User from '../models/User.js';

dotenv.config();

const testConcurrency = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ticket-booking';
  console.log(`Connecting to database at: ${mongoUri}`);
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }

  // Find a show
  const show = await Show.findOne();
  if (!show) {
    console.error('No show found. Please seed the database first.');
    process.exit(1);
  }

  // Find a customer user and admin user to simulate two different people
  const customer = await User.findOne({ role: 'customer' });
  const admin = await User.findOne({ role: 'admin' });

  if (!customer || !admin) {
    console.error('Test users not found. Please seed the database first.');
    process.exit(1);
  }

  // Find an available seat
  let seat = await Seat.findOne({ showId: show._id, status: 'available' });
  if (!seat) {
    console.log('No available seats found. Resetting first seat to available...');
    seat = await Seat.findOne({ showId: show._id });
    seat.status = 'available';
    seat.heldBy = null;
    seat.holdExpiresAt = null;
    await seat.save();
  }

  console.log(`Testing concurrency on seat: ${seat.seatNumber} (${seat._id})`);

  // Define two concurrent hold operations simulating race conditions
  const holdSeatAtomically = async (seatId, userId, userName) => {
    const holdExpiresAt = new Date(Date.now() + 5000); // 5 seconds hold for fast test
    try {
      // Conditional atomic update
      const result = await Seat.findOneAndUpdate(
        { _id: seatId, status: 'available' },
        {
          $set: {
            status: 'held',
            heldBy: userId,
            holdExpiresAt,
          },
        },
        { new: true }
      );

      if (result) {
        console.log(`[SUCCESS] ${userName} held seat ${seat.seatNumber}`);
        return { success: true, result };
      } else {
        console.log(`[FAILED] ${userName} could not hold seat ${seat.seatNumber} (already held/booked)`);
        return { success: false };
      }
    } catch (err) {
      console.error(`[ERROR] ${userName} request failed:`, err.message);
      return { success: false };
    }
  };

  // Launch both requests simultaneously
  console.log('Dispatching simultaneous hold requests...');
  const results = await Promise.all([
    holdSeatAtomically(seat._id, customer._id, 'Customer John'),
    holdSeatAtomically(seat._id, admin._id, 'Admin Boss'),
  ]);

  const successfulHolds = results.filter(r => r.success);
  console.log(`Test Finished. Successful holds count: ${successfulHolds.length}`);

  if (successfulHolds.length === 1) {
    console.log('PASSED: Concurrency check works perfectly (exactly one user succeeded).');
  } else {
    console.log('FAILED: Race condition allowed double holds or both failed.');
  }

  // Verify hold expiry auto-release manually
  console.log('Waiting 6 seconds to verify hold expiry release...');
  await new Promise(resolve => setTimeout(resolve, 6000));

  const refreshedSeat = await Seat.findById(seat._id);
  console.log(`Current seat status after 6s: ${refreshedSeat.status}`);
  
  // Clean up
  refreshedSeat.status = 'available';
  refreshedSeat.heldBy = null;
  refreshedSeat.holdExpiresAt = null;
  await refreshedSeat.save();

  await mongoose.disconnect();
};

testConcurrency();
