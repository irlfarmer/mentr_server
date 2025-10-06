import mongoose, { Document, Schema } from 'mongoose';

export interface IReferral extends Document {
  referrerId: mongoose.Types.ObjectId;
  refereeId: mongoose.Types.ObjectId;
  referralCode: string;
  status: 'pending' | 'active' | 'inactive';
  totalEarnings: number;
  lastEarningDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralSchema = new Schema<IReferral>({
  referrerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  refereeId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  referralCode: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'inactive'],
    default: 'pending'
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  lastEarningDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Ensure one referral per referee
ReferralSchema.index({ refereeId: 1 }, { unique: true });

export const Referral = mongoose.model<IReferral>('Referral', ReferralSchema);
