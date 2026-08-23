import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createServer } from 'http';
import authRoutes from './routes/auth.js';
import seatRoutes from './routes/seats.js';
import waitlistRoutes from './routes/waitlist.js';
import bookingRoutes from './routes/bookings.js';
import { initSocket } from './utils/socket.js';
import { startHoldExpiryWorker } from './workers/holdExpiryWorker.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Initialize socket.io
initSocket(httpServer);

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/seats', seatRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/bookings', bookingRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Ticket Booking API is running...' });
});

// Database connection & start server
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ticket-booking';

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB.');
    
    // Start background workers
    startHoldExpiryWorker();

    httpServer.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Database connection error:', error);
  });
