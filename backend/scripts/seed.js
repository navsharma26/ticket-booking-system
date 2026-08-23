import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Show from '../models/Show.js';
import Seat from '../models/Seat.js';
import Booking from '../models/Booking.js';
import Waitlist from '../models/Waitlist.js';

dotenv.config();

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ticket-booking';
    console.log(`Connecting to MongoDB at: ${mongoUri}...`);
    await mongoose.connect(mongoUri);

    // Clear existing data
    console.log('Clearing existing data...');
    await User.deleteMany({});
    await Show.deleteMany({});
    await Seat.deleteMany({});
    await Booking.deleteMany({});
    await Waitlist.deleteMany({});

    console.log('Seeding users...');
    // Create Organizer
    const organizer = await User.create({
      name: 'Emma Watson (Organizer)',
      email: 'organizer@example.com',
      password: 'password123',
      role: 'organizer',
    });

    // Create Customer
    const customer = await User.create({
      name: 'John Doe (Customer)',
      email: 'customer@example.com',
      password: 'password123',
      role: 'customer',
    });

    // Create Admin
    const admin = await User.create({
      name: 'Admin Boss',
      email: 'admin@example.com',
      password: 'password123',
      role: 'admin',
    });

    console.log('Seeding show/event...');
    const showTime = new Date();
    showTime.setDate(showTime.getDate() + 30); // 30 days from now

    const show = await Show.create({
      title: 'Grand Symphony Concert 2026',
      description: 'An evening of majestic classical music performed by the Royal Philharmonic Orchestra.',
      venue: 'Metropolitan Opera House, New York',
      showTime: showTime,
      seatCategories: [
        { name: 'VIP', price: 150 },
        { name: 'General', price: 50 },
      ],
    });

    console.log('Seeding grid of seats...');
    // Let's create a 5x10 grid of seats (Rows A to E, Seats 1 to 10)
    // Rows A-B: VIP, Rows C-E: General
    const seats = [];
    const rows = ['A', 'B', 'C', 'D', 'E'];

    for (const row of rows) {
      const category = (row === 'A' || row === 'B') ? 'VIP' : 'General';
      for (let num = 1; num <= 10; num++) {
        seats.push({
          showId: show._id,
          seatNumber: `${row}${num}`,
          category: category,
          status: 'available',
        });
      }
    }

    const createdSeats = await Seat.insertMany(seats);

    console.log('Database successfully seeded!');
    console.log('----------------------------------------------------');
    console.log(`Organizer: ${organizer.email} (password: password123)`);
    console.log(`Customer: ${customer.email} (password: password123)`);
    console.log(`Admin: ${admin.email} (password: password123)`);
    console.log(`Show: "${show.title}" at "${show.venue}"`);
    console.log(`Total seats created: ${createdSeats.length} (Row A & B: VIP, Row C-E: General)`);
    console.log('----------------------------------------------------');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedData();
