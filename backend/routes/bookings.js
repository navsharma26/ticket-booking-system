import express from 'express';
import QRCode from 'qrcode';
import Booking from '../models/Booking.js';
import Seat from '../models/Seat.js';
import Show from '../models/Show.js';
import { protect } from '../middleware/auth.js';
import { processWaitlistQueue } from '../utils/waitlistProcessor.js';
import { sendTicketConfirmationEmail } from '../utils/email.js';
import { broadcastSeatUpdate } from '../utils/socket.js';

const router = express.Router();

// @desc    Confirm held seats and finalize booking (Checkout)
// @route   POST /api/bookings/confirm
// @access  Private
router.post('/confirm', protect, async (req, res) => {
  try {
    const { showId, seatIds } = req.body;
    const userId = req.user._id;

    if (!showId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({ message: 'Please provide showId and seatIds' });
    }

    const now = new Date();

    // 1. Verify seats are held by this user and not expired
    const seats = await Seat.find({
      _id: { $in: seatIds },
      showId,
      status: 'held',
      heldBy: userId,
      holdExpiresAt: { $gt: now },
    });

    if (seats.length !== seatIds.length) {
      return res.status(400).json({ message: 'Hold has expired or seats are no longer reserved' });
    }

    // 2. Fetch Show details for pricing and title
    const show = await Show.findById(showId);
    if (!show) {
      return res.status(404).json({ message: 'Show not found' });
    }

    // Calculate total price
    let totalPrice = 0;
    const seatNumbers = [];
    for (const seat of seats) {
      seatNumbers.push(seat.seatNumber);
      const category = show.seatCategories.find((cat) => cat.name === seat.category);
      if (category) {
        totalPrice += category.price;
      }
    }

    // 3. Create initial Booking
    const booking = await Booking.create({
      userId,
      showId,
      seats: seatIds,
      totalPrice,
      status: 'confirmed',
    });

    // 4. Generate QR Code containing booking details
    const qrData = JSON.stringify({
      bookingId: booking._id,
      userName: req.user.name,
      showTitle: show.title,
      seats: seatNumbers,
    });

    const qrCodeDataUrl = await QRCode.toDataURL(qrData);

    // Save QR data URL in booking
    booking.qrCodeUrl = qrCodeDataUrl;
    await booking.save();

    // 5. Update seat status to booked
    await Seat.updateMany(
      { _id: { $in: seatIds } },
      {
        $set: {
          status: 'booked',
          heldBy: null,
          holdExpiresAt: null,
        },
      }
    );

    // 6. Broadcast seat status change (SEAT_BOOKED)
    broadcastSeatUpdate('SEAT_BOOKED', {
      showId,
      seatIds,
      userId,
    });

    // 7. Send ticket confirmation email in background (don't block HTTP thread)
    sendTicketConfirmationEmail({
      to: req.user.email,
      userName: req.user.name,
      showTitle: show.title,
      venue: show.venue,
      showTime: show.showTime,
      seatNumbers,
      totalPrice,
      qrCodeDataUrl,
    }).catch((err) => {
      console.error('[BookingConfirmation] Email sending background task failed:', err);
    });

    return res.status(201).json({
      message: 'Booking finalized and confirmed successfully',
      booking,
    });
  } catch (error) {
    console.error('Error confirming booking:', error);
    return res.status(500).json({ message: error.message });
  }
});

// @desc    Cancel a booking
// @route   POST /api/bookings/:id/cancel
// @access  Private
router.post('/:id/cancel', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to cancel this booking' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ message: 'Booking is already cancelled' });
    }

    // Mark booking as cancelled
    booking.status = 'cancelled';
    await booking.save();

    console.log(`[BookingCancellation] Booking ${booking._id} cancelled. Releasing seats...`);

    // Trigger waitlist processor for each seat released
    for (const seatId of booking.seats) {
      await processWaitlistQueue(booking.showId, seatId);
    }

    return res.json({
      message: 'Booking cancelled successfully, seats processed for waitlist',
      booking,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// @desc    Get user bookings
// @route   GET /api/bookings/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user._id }).populate('seats');
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
