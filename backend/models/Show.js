import mongoose from 'mongoose';

const seatCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
});

const showSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    venue: {
      type: String,
      required: true,
      trim: true,
    },
    showTime: {
      type: Date,
      required: true,
    },
    seatCategories: [seatCategorySchema],
  },
  {
    timestamps: true,
  }
);

const Show = mongoose.model('Show', showSchema);
export default Show;
