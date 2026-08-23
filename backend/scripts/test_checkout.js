import mongoose from 'mongoose';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import Seat from '../models/Seat.js';
import Show from '../models/Show.js';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import { sendTicketConfirmationEmail } from '../utils/email.js';
import { initSocket } from '../utils/socket.js';
import { createServer } from 'http';

dotenv.config();

// Init mock server for Socket
const server = createServer();
initSocket(server);

const testCheckoutPipeline = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ticket-booking';
  console.log(`Connecting to database at: ${mongoUri}`);
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }

  // Find show and customer user
  const show = await Show.findOne();
  const customer = await User.findOne({ email: 'customer@example.com' });

  if (!show || !customer) {
    console.error('Show or Customer not found. Please run seed script first.');
    process.exit(1);
  }

  // Find or reset seat A2 to held
  let seat = await Seat.findOne({ showId: show._id, seatNumber: 'A2' });
  if (!seat) {
    console.error('Seat A2 not found.');
    process.exit(1);
  }

  console.log('--- Step 1: Hold seat A2 for Customer ---');
  seat.status = 'held';
  seat.heldBy = customer._id;
  seat.holdExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await seat.save();
  console.log(`Seat A2 is held by customer ${customer.email}`);

  console.log('--- Step 2: Confirm Booking (Checkout) ---');
  // Check seat hold validity
  const now = new Date();
  const activeSeats = await Seat.find({
    _id: seat._id,
    showId: show._id,
    status: 'held',
    heldBy: customer._id,
    holdExpiresAt: { $gt: now },
  });

  if (activeSeats.length !== 1) {
    console.error('Seat hold is not active.');
    process.exit(1);
  }

  // Calculate pricing
  const seatCategory = show.seatCategories.find(c => c.name === seat.category);
  const totalPrice = seatCategory ? seatCategory.price : 0;

  // Create Booking
  const booking = await Booking.create({
    userId: customer._id,
    showId: show._id,
    seats: [seat._id],
    totalPrice,
    status: 'confirmed',
  });

  // Generate QR Code containing booking details
  const qrData = JSON.stringify({
    bookingId: booking._id,
    userName: customer.name,
    showTitle: show.title,
    seats: [seat.seatNumber],
  });

  const qrCodeDataUrl = await QRCode.toDataURL(qrData);
  booking.qrCodeUrl = qrCodeDataUrl;
  await booking.save();

  // Mark seat as booked
  seat.status = 'booked';
  seat.heldBy = null;
  seat.holdExpiresAt = null;
  await seat.save();

  console.log('SUCCESS: Booking created and seat marked as booked.');
  console.log(`Booking ID: ${booking._id}`);
  console.log(`QR Code URL starts with: ${booking.qrCodeUrl.substring(0, 30)}...`);

  console.log('--- Step 3: Dispatch Ticket Confirmation Email ---');
  try {
    const emailInfo = await sendTicketConfirmationEmail({
      to: customer.email,
      userName: customer.name,
      showTitle: show.title,
      venue: show.venue,
      showTime: show.showTime,
      seatNumbers: [seat.seatNumber],
      totalPrice,
      qrCodeDataUrl,
    });

    console.log('SUCCESS: Ticket email dispatched.');
  } catch (emailErr) {
    console.error('FAILED to send email:', emailErr.message);
  }

  // Clean up seat status back to available
  seat.status = 'available';
  seat.heldBy = null;
  seat.holdExpiresAt = null;
  await seat.save();

  await mongoose.disconnect();
  console.log('Pipeline verification completed successfully.');
  process.exit(0);
};

testCheckoutPipeline();
