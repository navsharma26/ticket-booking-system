import mongoose from 'mongoose';

const waitlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    showId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Show',
      required: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['waiting', 'offered', 'expired'],
      default: 'waiting',
    },
    offerExpiresAt: {
      type: Date,
      default: null,
    },
    position: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure uniqueness of waiting users per show category
waitlistSchema.index({ showId: 1, category: 1, userId: 1 }, { unique: true });

const Waitlist = mongoose.model('Waitlist', waitlistSchema);
export default Waitlist;
