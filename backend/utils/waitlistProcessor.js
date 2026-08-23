import Seat from '../models/Seat.js';
import Waitlist from '../models/Waitlist.js';
import { broadcastSeatUpdate, getIO } from './socket.js';

/**
 * Processes the waitlist for a released seat.
 * Checks if there is any user waiting for this seat's category on this show.
 * If yes, holds the seat for the first waiting user in FIFO order and sets an offer window.
 * If no, keeps/reverts the seat to 'available'.
 * 
 * @param {string} showId 
 * @param {string} seatId 
 */
export const processWaitlistQueue = async (showId, seatId) => {
  try {
    const seat = await Seat.findById(seatId);
    if (!seat) {
      console.warn(`[WaitlistProcessor] Seat ${seatId} not found.`);
      return;
    }

    // Find the next waiting user (FIFO: position ascending)
    const nextInLine = await Waitlist.findOne({
      showId,
      category: seat.category,
      status: 'waiting',
    }).sort({ position: 1, createdAt: 1 });

    if (nextInLine) {
      const offerTTL = 5 * 60 * 1000; // 5 minutes offer window
      const offerExpiresAt = new Date(Date.now() + offerTTL);

      // Reserve the seat specifically for this user
      seat.status = 'held';
      seat.heldBy = nextInLine.userId;
      seat.holdExpiresAt = offerExpiresAt;
      await seat.save();

      // Update waitlist status to 'offered'
      nextInLine.status = 'offered';
      nextInLine.offerExpiresAt = offerExpiresAt;
      await nextInLine.save();

      console.log(`[WaitlistProcessor] Seat ${seat.seatNumber} offered to user ${nextInLine.userId}. Offer expires at ${offerExpiresAt}`);

      // Broadcast seat status update
      broadcastSeatUpdate('SEAT_HELD', {
        showId,
        seatIds: [seat._id],
        userId: nextInLine.userId,
        holdExpiresAt: offerExpiresAt,
      });

      // Broadcast waitlist offered event for real-time notification
      const io = getIO();
      if (io) {
        io.emit('WAITLIST_OFFERED', {
          userId: nextInLine.userId,
          showId,
          seatId: seat._id,
          seatNumber: seat.seatNumber,
          category: seat.category,
          offerExpiresAt,
        });
      }
    } else {
      // No one waiting, set the seat back to available
      seat.status = 'available';
      seat.heldBy = null;
      seat.holdExpiresAt = null;
      await seat.save();

      console.log(`[WaitlistProcessor] No users on waitlist for category ${seat.category}. Seat ${seat.seatNumber} is now available.`);

      // Broadcast seat release
      broadcastSeatUpdate('SEAT_RELEASED', {
        showId,
        seatIds: [seat._id],
      });
    }
  } catch (error) {
    console.error(`[WaitlistProcessor] Error processing waitlist for seat ${seatId}:`, error);
  }
};
