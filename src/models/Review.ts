import mongoose, { Document, Schema } from 'mongoose';

export interface IReview extends Document {
  serviceId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  mentorId: mongoose.Types.ObjectId;
  bookingId: mongoose.Types.ObjectId;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>({
  serviceId: {
    type: Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  studentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  mentorId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bookingId: {
    type: Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    unique: true // One review per booking
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true,
    maxlength: 1000
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
ReviewSchema.index({ serviceId: 1 });
ReviewSchema.index({ mentorId: 1 });
ReviewSchema.index({ studentId: 1 });
// bookingId already has unique index from field definition
ReviewSchema.index({ rating: 1 });

export const Review = mongoose.model<IReview>('Review', ReviewSchema);
