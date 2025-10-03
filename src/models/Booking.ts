import mongoose, { Document, Schema } from 'mongoose';

export interface IBooking extends Document {
  serviceId: mongoose.Types.ObjectId;
  mentorId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  scheduledAt: Date;
  scheduledAtUTC: Date; // Store in UTC for consistency
  mentorTimezone: string;
  studentTimezone: string;
  duration: number; // in minutes
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'reviewable' | 'reviewed';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  paymentMethod: 'stripe' | 'tokens';
  amount: number;
  // Commission and payout tracking
  platformCommission?: number;
  mentorPayout?: number;
  commissionTier?: string;
  payoutStatus?: 'pending' | 'processing' | 'paid' | 'failed' | 'disputed';
  payoutDate?: Date;
  disputePeriodEnds?: Date;
  stripeTransferId?: string;
  stripePaymentIntentId?: string;
  meetingUrl?: string;
  notes?: string;
  cancellationPolicy: {
    minimumCancellationHours: number; // Hours before session when cancellation is no longer allowed
    mentorId: mongoose.Types.ObjectId; // Reference to mentor who set this policy
    setAt: Date; // When this policy was set (at booking time)
  };
  refund?: {
    status: 'none' | 'pending' | 'processed' | 'failed';
    type: 'payment_method' | 'tokens';
    amount: number;
    stripeRefundId?: string;
    processedAt?: Date;
    reason?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>({
  serviceId: {
    type: Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  mentorId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  studentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  scheduledAt: {
    type: Date,
    required: true
  },
  scheduledAtUTC: {
    type: Date,
    required: true
  },
  mentorTimezone: {
    type: String,
    required: true,
    default: 'UTC'
  },
  studentTimezone: {
    type: String,
    required: true,
    default: 'UTC'
  },
  duration: {
    type: Number,
    required: true,
    min: 15,
    max: 480 // 8 hours max
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled', 'reviewable', 'reviewed'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['stripe', 'tokens'],
    default: 'stripe'
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  // Commission and payout tracking
  platformCommission: {
    type: Number,
    min: 0
  },
  mentorPayout: {
    type: Number,
    min: 0
  },
  commissionTier: {
    type: String,
    enum: ['tier1', 'tier2', 'tier3', 'tier4', 'tier5', 'tier6', 'tier7', 'tier8']
  },
  payoutStatus: {
    type: String,
    enum: ['pending', 'processing', 'paid', 'failed', 'disputed'],
    default: 'pending'
  },
  payoutDate: {
    type: Date
  },
  disputePeriodEnds: {
    type: Date
  },
  stripeTransferId: {
    type: String
  },
  stripePaymentIntentId: {
    type: String
  },
  meetingUrl: {
    type: String
  },
  notes: {
    type: String,
    maxlength: 1000
  },
  cancellationPolicy: {
    minimumCancellationHours: {
      type: Number,
      required: true,
      min: 1,
      max: 168 // Max 1 week
    },
    mentorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    setAt: {
      type: Date,
      required: true,
      default: Date.now
    }
  },
  refund: {
    status: {
      type: String,
      enum: ['none', 'pending', 'processed', 'failed'],
      default: 'none'
    },
    type: {
      type: String,
      enum: ['payment_method', 'tokens']
    },
    amount: {
      type: Number,
      min: 0
    },
    stripeRefundId: {
      type: String
    },
    processedAt: {
      type: Date
    },
    reason: {
      type: String
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
BookingSchema.index({ mentorId: 1, scheduledAt: 1 });
BookingSchema.index({ studentId: 1, scheduledAt: 1 });
BookingSchema.index({ serviceId: 1 });
BookingSchema.index({ status: 1 });
BookingSchema.index({ paymentStatus: 1 });

export const Booking = mongoose.model<IBooking>('Booking', BookingSchema);
