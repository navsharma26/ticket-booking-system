import cron from 'node-cron';
import Seat from '../models/Seat.js';
import Waitlist from '../models/Waitlist.js';
import { broadcastSeatUpdate } from '../utils/socket.js';
import { processWaitlistQueue } from '../utils/waitlistProcessor.js';

export const startHoldExpiryWorker = () => {
  // Cron schedule: Run every 15 seconds
  cron.schedule('*/15 * * * * *', async () => {
    try {
      const now = new Date();

      // PART 1: Handle standard seat hold expirations
      // Find all seats whose hold has expired AND are NOT offered to waitlist (i.e. holdExpiresAt < now)
      // Note: Seats held for waitlisted users have a corresponding offered waitlist entry.
      // We process waitlist offer expirations in PART 2, so here we filter out seats whose held user
      // has an active waitlist offer or we can clean up standard holds that don't have waitlist entries.
      // Actually, a simple approach: if a waitlist offer expires, we handle it separately.
      // For standard holds (where the user did NOT hold it via waitlist offer, or waitlist status is not offered),
      // we release them and run waitlist processor.
      
      const expiredSeats = await Seat.find({
        status: 'held',
        holdExpiresAt: { $lt: now },
      });

      if (expiredSeats.length > 0) {
        console.log(`[HoldExpiryWorker] Found ${expiredSeats.length} expired seat holds.`);
        
        for (const seat of expiredSeats) {
          // Check if this seat hold belongs to an active waitlist offer
          const activeOffer = await Waitlist.findOne({
            showId: seat.showId,
            userId: seat.heldBy,
            status: 'offered',
            offerExpiresAt: { $gt: now }, // still valid
          });

          if (activeOffer) {
            // Do not release yet, waitlist offer is still active
            continue;
          }

          // Check if it's an expired waitlist offer
          const expiredOffer = await Waitlist.findOne({
            showId: seat.showId,
            userId: seat.heldBy,
            status: 'offered',
            offerExpiresAt: { $lte: now },
          });

          if (expiredOffer) {
            // Mark waitlist entry as expired
            expiredOffer.status = 'expired';
            await expiredOffer.save();
            console.log(`[HoldExpiryWorker] Waitlist offer for user ${expiredOffer.userId} expired.`);
          }

          // Trigger waitlist queue processing to assign to the next user or release
          await processWaitlistQueue(seat.showId, seat._id);
        }
      }

      // PART 2: Clean up any remaining expired waitlist offers that might not have a seat record
      const remainingExpiredOffers = await Waitlist.find({
        status: 'offered',
        offerExpiresAt: { $lt: now },
      });

      for (const offer of remainingExpiredOffers) {
        offer.status = 'expired';
        await offer.save();
        console.log(`[HoldExpiryWorker] Cleaned up orphaned expired waitlist offer for user ${offer.userId}`);
      }

    } catch (error) {
      console.error('[HoldExpiryWorker] Error running cleanup job:', error);
    }
  });

  console.log('[HoldExpiryWorker] Hold & Waitlist expiry background worker initialized (every 15s).');
};
