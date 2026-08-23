import express from 'express';
import mongoose from 'mongoose';
import Seat from '../models/Seat.js';
import Show from '../models/Show.js';
import { protect } from '../middleware/auth.js';
import { broadcastSeatUpdate } from '../utils/socket.js';


const router = express.Router();

// Helper to execute seat hold atomically (using transactions or fallback to conditional update)
const holdSeatsAtomic = async (showId, seatIds, userId) => {
  const holdExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes hold

  // Try with Transaction first
  const session = await mongoose.startSession();
  try {
    let success = false;
    await session.withTransaction(async () => {
      // Find seats that match the ids and are currently available
      const seats = await Seat.find({
        _id: { $in: seatIds },
        showId,
        status: 'available',
      }).session(session);

      if (seats.length !== seatIds.length) {
        throw new Error('One or more selected seats are no longer available');
      }

      // Update seats atomically
      const result = await Seat.updateMany(
        { _id: { $in: seatIds }, showId, status: 'available' },
        {
          $set: {
            status: 'held',
            heldBy: userId,
            holdExpiresAt,
          },
        },
        { session }
      );

      if (result.modifiedCount !== seatIds.length) {
        throw new Error('Concurrency conflict: Some seats were modified during request');
      }
      success = true;
    });

    session.endSession();
    return { success, holdExpiresAt };
  } catch (err) {
    session.endSession();
    
    // Check if error is due to MongoDB running as standalone (no replica set configured)
    const isStandaloneError = 
      err.message.includes('replica set') || 
      err.message.includes('Transaction numbers');

    if (isStandaloneError) {
      console.warn('MongoDB Transactions not supported on standalone instance. Falling back to atomic conditional updates...');
      
      // Fallback: Perform atomic updates sequentially or using bulk write, verifying modifiedCount
      // We check availability and perform update in a single atomic updateMany call
      const result = await Seat.updateMany(
        { 
          _id: { $in: seatIds }, 
          showId, 
          status: 'available' 
        },
        {
          $set: {
            status: 'held',
            heldBy: userId,
            holdExpiresAt,
          },
        }
      );

      if (result.modifiedCount !== seatIds.length) {
        // If not all could be modified, some seats were already held/booked.
        // Rollback the ones we successfully held (if any) to preserve all-or-nothing semantics
        await Seat.updateMany(
          { _id: { $in: seatIds }, heldBy: userId, status: 'held', holdExpiresAt },
          { $set: { status: 'available', heldBy: null, holdExpiresAt: null } }
        );
        throw new Error('One or more selected seats are no longer available');
      }

      return { success: true, holdExpiresAt };
    }

    // Rethrow any other business logic error
    throw err;
  }
};

// @desc    Hold seats for a show
// @route   POST /api/seats/hold
// @access  Private (Customer/Organizer/Admin)
router.post('/hold', protect, async (req, res) => {
  try {
    const { showId, seatIds } = req.body;
    const userId = req.user._id;

    if (!showId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({ message: 'Please provide showId and a non-empty list of seatIds' });
    }

    const { success, holdExpiresAt } = await holdSeatsAtomic(showId, seatIds, userId);

    if (success) {
      // Broadcast real-time status update to all connected clients
      broadcastSeatUpdate('SEAT_HELD', {
        showId,
        seatIds,
        userId,
        holdExpiresAt,
      });

      return res.status(200).json({
        message: 'Seats held successfully',
        seatIds,
        holdExpiresAt,
      });
    } else {
      return res.status(400).json({ message: 'Failed to hold seats' });
    }
  } catch (error) {
    console.error('Error holding seats:', error.message);
    return res.status(409).json({ message: error.message });
  }
});

// @desc    Create a new show and populate its seat grid
// @route   POST /api/seats/show
// @access  Private (Organizer/Admin)
router.post('/show', protect, async (req, res) => {
  try {
    const { title, description, venue, showTime, seatCategories } = req.body;

    if (!title || !venue || !showTime || !seatCategories) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const show = await Show.create({
      title,
      description,
      venue,
      showTime: new Date(showTime),
      seatCategories,
    });

    // Populate seat grid: 5x10 grid (Rows A-E, Numbers 1-10)
    // Row A-B: VIP (or first category), Row C-E: General (or second category)
    const seats = [];
    const rows = ['A', 'B', 'C', 'D', 'E'];
    const vipCat = seatCategories.find(c => c.name === 'VIP') || seatCategories[0];
    const genCat = seatCategories.find(c => c.name === 'General') || seatCategories[1] || seatCategories[0];

    for (const row of rows) {
      const category = (row === 'A' || row === 'B') ? vipCat.name : genCat.name;
      for (let num = 1; num <= 10; num++) {
        seats.push({
          showId: show._id,
          seatNumber: `${row}${num}`,
          category: category,
          status: 'available',
        });
      }
    }

    await Seat.insertMany(seats);

    return res.status(201).json({
      message: 'Show and seat grid populated successfully',
      show,
    });
  } catch (error) {
    console.error('Error creating show:', error);
    return res.status(500).json({ message: error.message });
  }
});

// @desc    Get all shows
// @route   GET /api/seats/shows
// @access  Public
router.get('/shows', async (req, res) => {
  try {
    const shows = await Show.find().sort({ showTime: 1 });
    res.json(shows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get all seats for a show
// @route   GET /api/seats/show/:showId
// @access  Public
router.get('/show/:showId', async (req, res) => {
  try {
    const seats = await Seat.find({ showId: req.params.showId });
    res.json(seats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;

