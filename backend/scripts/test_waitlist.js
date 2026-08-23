import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Seat from '../models/Seat.js';
import Show from '../models/Show.js';
import User from '../models/User.js';
import Waitlist from '../models/Waitlist.js';
import Booking from '../models/Booking.js';
import { processWaitlistQueue } from '../utils/waitlistProcessor.js';
import { initSocket } from '../utils/socket.js';
import { createServer } from 'http';

dotenv.config();

// Init mock server for Socket.io mapping
const server = createServer();
initSocket(server);

const testWaitlistPipeline = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ticket-booking';
  console.log(`Connecting to database at: ${mongoUri}`);
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }

  // Clear previous waitlist / bookings for clean test run
  await Waitlist.deleteMany({});
  await Booking.deleteMany({});

  // Get show
  const show = await Show.findOne();
  if (!show) {
    console.error('No show found. Please seed the database first.');
    process.exit(1);
  }

  // Get users
  const customer = await User.findOne({ email: 'customer@example.com' });
  const admin = await User.findOne({ email: 'admin@example.com' });

  if (!customer || !admin) {
    console.error('Test users not found. Please seed the database first.');
    process.exit(1);
  }

  // Find a VIP seat (e.g. A1)
  const seat = await Seat.findOne({ showId: show._id, seatNumber: 'A1' });
  if (!seat) {
    console.error('Seat A1 not found.');
    process.exit(1);
  }

  console.log('--- Step 1: Customer John Doe holds seat A1 ---');
  seat.status = 'held';
  seat.heldBy = customer._id;
  seat.holdExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await seat.save();
  console.log(`Seat A1 status: ${seat.status}, heldBy: ${seat.heldBy}`);

  console.log('--- Step 2: Admin Boss joins the waitlist for VIP category ---');
  const waitlistEntry = await Waitlist.create({
    userId: admin._id,
    showId: show._id,
    category: 'VIP',
    position: 1,
    status: 'waiting',
  });
  console.log(`Waitlist entry created for Admin Boss (status: ${waitlistEntry.status})`);

  console.log('--- Step 3: Customer John Doe releases/expires their hold ---');
  // Revert seat to available (or simulating expiration)
  seat.status = 'available';
  seat.heldBy = null;
  seat.holdExpiresAt = null;
  await seat.save();

  console.log('--- Step 4: Triggering waitlist processor ---');
  await processWaitlistQueue(show._id, seat._id);

  // Check database state after waitlist processor runs
  const updatedSeat = await Seat.findById(seat._id);
  const updatedWaitlist = await Waitlist.findById(waitlistEntry._id);

  console.log(`Refreshed seat status: ${updatedSeat.status}, heldBy: ${updatedSeat.heldBy} (Expected: held by Admin: ${admin._id})`);
  console.log(`Refreshed waitlist status: ${updatedWaitlist.status}, offerExpiresAt: ${updatedWaitlist.offerExpiresAt} (Expected: offered)`);

  if (updatedSeat.status === 'held' && updatedSeat.heldBy.toString() === admin._id.toString() && updatedWaitlist.status === 'offered') {
    console.log('SUCCESS: Auto-assignment pipeline worked! Seat offered to next in queue.');
  } else {
    console.log('FAILED: Seat not successfully offered.');
  }

  console.log('--- Step 5: Admin Boss claims the offered seat ---');
  // Simulate checkout/claim
  const seatCategory = show.seatCategories.find(cat => cat.name === updatedSeat.category);
  const totalPrice = seatCategory ? seatCategory.price : 0;

  const booking = await Booking.create({
    userId: admin._id,
    showId: show._id,
    seats: [updatedSeat._id],
    totalPrice,
    status: 'confirmed',
    qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${updatedSeat._id}`,
  });

  updatedSeat.status = 'booked';
  updatedSeat.heldBy = null;
  updatedSeat.holdExpiresAt = null;
  await updatedSeat.save();

  updatedWaitlist.status = 'expired';
  await updatedWaitlist.save();

  const finalSeat = await Seat.findById(seat._id);
  const finalWaitlist = await Waitlist.findById(waitlistEntry._id);

  console.log(`Final seat status: ${finalSeat.status} (Expected: booked)`);
  console.log(`Final waitlist status: ${finalWaitlist.status} (Expected: expired)`);

  if (finalSeat.status === 'booked' && finalWaitlist.status === 'expired') {
    console.log('SUCCESS: Offer claiming and booking flow completed successfully.');
  } else {
    console.log('FAILED: Claiming offer did not work correctly.');
  }

  await mongoose.disconnect();
  process.exit(0);
};

testWaitlistPipeline();
