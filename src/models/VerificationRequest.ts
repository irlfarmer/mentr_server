import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IVerificationRequest extends Document {
  userId: Types.ObjectId;
  stripePaymentId: string;
  status: 'pending_payment' | 'pending_review' | 'approved' | 'rejected';
  documents: Array<{
    name: string;
    url: string;
    type: string;
  }>;
  adminNotes?: string;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VerificationRequestSchema = new Schema<IVerificationRequest>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  stripePaymentId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending_payment', 'pending_review', 'approved', 'rejected'],
    default: 'pending_payment'
  },
  documents: [{
    name: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, required: true }
  }],
  adminNotes: {
    type: String
  },
  rejectionReason: {
    type: String
  }
}, {
  timestamps: true
});

VerificationRequestSchema.index({ userId: 1 });
VerificationRequestSchema.index({ status: 1 });

export default mongoose.model<IVerificationRequest>('VerificationRequest', VerificationRequestSchema);
