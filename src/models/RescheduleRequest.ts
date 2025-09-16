import mongoose, { Document, Schema } from 'mongoose';

export interface IRescheduleRequest extends Document {
  bookingId: mongoose.Types.ObjectId;
  requestedBy: mongoose.Types.ObjectId;
  requestedAt: Date;
  newScheduledAt: Date;
  newScheduledAtUTC: Date;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  respondedBy?: mongoose.Types.ObjectId;
  respondedAt?: Date;
  responseReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RescheduleRequestSchema = new Schema<IRescheduleRequest>({
  bookingId: {
    type: Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  requestedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  newScheduledAt: {
    type: Date,
    required: true
  },
  newScheduledAtUTC: {
    type: Date,
    required: true
  },
  reason: {
    type: String,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  respondedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  respondedAt: {
    type: Date
  },
  responseReason: {
    type: String,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Index for efficient queries
RescheduleRequestSchema.index({ bookingId: 1, status: 1 });
RescheduleRequestSchema.index({ requestedBy: 1, status: 1 });
RescheduleRequestSchema.index({ respondedBy: 1, status: 1 });

export default mongoose.model<IRescheduleRequest>('RescheduleRequest', RescheduleRequestSchema);
