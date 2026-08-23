import express from 'express';
import Waitlist from '../models/Waitlist.js';
import Show from '../models/Show.js';
import Seat from '../models/Seat.js';
import Booking from '../models/Booking.js';
import { protect } from '../middleware/auth.js';
import { broadcastSeatUpdate } from '../utils/socket.js';

const router = express.Router();

// @desc    Join waitlist for a sold-out category
// @route   POST /api/waitlist/join
// @access  Private
router.post('/join', protect, async (req, res) => {
  try {
    const { showId, category } = req.body;
    const userId = req.user._id;

    if (!showId || !category) {
      return res.status(400).json({ message: 'Please provide showId and category' });
    }

    // Check if show exists
    const show = await Show.findById(showId);
    if (!show) {
      return res.status(404).json({ message: 'Show not found' });
    }

    // Verify category exists in show
    const categoryExists = show.seatCategories.some(cat => cat.name === category);
    if (!categoryExists) {
      return res.status(400).json({ message: `Category '${category}' does not exist on this show` });
    }

    // Check if user is already on the waitlist for this show and category
    const existingWaitlist = await Waitlist.findOne({
      showId,
      category,
      userId,
      status: 'waiting',
    });

    if (existingWaitlist) {
      return res.status(400).json({ message: 'You are already on the waitlist for this category' });
    }

    // Calculate queue position (FIFO)
    const activeWaitlistCount = await Waitlist.countDocuments({
      showId,
      category,
      status: 'waiting',
    });
    const position = activeWaitlistCount + 1;

    const waitlistEntry = await Waitlist.create({
      userId,
      showId,
      category,
      position,
      status: 'waiting',
    });

    return res.status(201).json({
      message: 'Joined waitlist successfully',
      waitlistEntry,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// @desc    Claim waitlist offer and complete booking
// @route   POST /api/waitlist/claim
// @access  Private
router.post('/claim', protect, async (req, res) => {
  try {
    const { showId, seatId } = req.body;
    const userId = req.user._id;

    if (!showId || !seatId) {
      return res.status(400).json({ message: 'Please provide showId and seatId' });
    }

    const now = new Date();

    // 1. Find the active offered waitlist entry for the user
    const waitlistEntry = await Waitlist.findOne({
      showId,
      userId,
      status: 'offered',
      offerExpiresAt: { $gt: now },
    });

    if (!waitlistEntry) {
      return res.status(400).json({ message: 'No active seat offer found or the offer has expired' });
    }

    // 2. Find the seat held for this user
    const seat = await Seat.findOne({
      _id: seatId,
      showId,
      heldBy: userId,
      status: 'held',
      holdExpiresAt: { $gt: now },
    });

    if (!seat) {
      return res.status(400).json({ message: 'Seat hold is no longer valid or has expired' });
    }

    // 3. Find the show to get price
    const show = await Show.findById(showId);
    if (!show) {
      return res.status(404).json({ message: 'Show not found' });
    }

    const seatCategory = show.seatCategories.find(cat => cat.name === seat.category);
    const totalPrice = seatCategory ? seatCategory.price : 0;

    // 4. Create the Booking
    const booking = await Booking.create({
      userId,
      showId,
      seats: [seat._id],
      totalPrice,
      status: 'confirmed',
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${seat._id}`,
    });

    // 5. Update seat status to booked
    seat.status = 'booked';
    seat.heldBy = null;
    seat.holdExpiresAt = null;
    await seat.save();

    // 6. Update waitlist entry to expired/complete
    waitlistEntry.status = 'expired'; // mark as used/expired
    await waitlistEntry.save();

    // Broadcast seat status update
    broadcastSeatUpdate('SEAT_BOOKED', {
      showId,
      seatIds: [seat._id],
      userId,
    });

    return res.status(201).json({
      message: 'Offer claimed and booking completed successfully',
      booking,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// @desc    Get user waitlist status
// @route   GET /api/waitlist/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const list = await Waitlist.find({ userId: req.user._id });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
