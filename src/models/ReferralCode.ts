import mongoose, { Document, Schema } from 'mongoose';

export interface IReferralCode extends Document {
  userId: mongoose.Types.ObjectId;
  code: string;
  isActive: boolean;
  totalUses: number;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralCodeSchema = new Schema<IReferralCode>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    index: true,
    uppercase: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  totalUses: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

export const ReferralCode = mongoose.model<IReferralCode>('ReferralCode', ReferralCodeSchema);
