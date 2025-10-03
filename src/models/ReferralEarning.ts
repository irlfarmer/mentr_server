import mongoose, { Document, Schema } from 'mongoose';

export interface IReferralEarning extends Document {
  referrerId: mongoose.Types.ObjectId;
  refereeId: mongoose.Types.ObjectId;
  referralId: mongoose.Types.ObjectId;
  sourceType: 'booking' | 'chat' | 'token_purchase';
  sourceId: mongoose.Types.ObjectId; // bookingId, messageId, or transactionId
  amount: number; // Original transaction amount
  commissionRate: number; // 0.01 for 1%
  commissionAmount: number; // Amount earned as commission
  status: 'pending' | 'paid' | 'cancelled';
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralEarningSchema = new Schema<IReferralEarning>({
  referrerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  refereeId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  referralId: {
    type: Schema.Types.ObjectId,
    ref: 'Referral',
    required: true,
    index: true
  },
  sourceType: {
    type: String,
    enum: ['booking', 'chat', 'token_purchase'],
    required: true
  },
  sourceId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true
  },
  commissionRate: {
    type: Number,
    default: 0.01 // 1%
  },
  commissionAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'cancelled'],
    default: 'pending'
  },
  paidAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Prevent duplicate earnings for the same source
ReferralEarningSchema.index({ sourceId: 1, sourceType: 1 }, { unique: true });

export const ReferralEarning = mongoose.model<IReferralEarning>('ReferralEarning', ReferralEarningSchema);
