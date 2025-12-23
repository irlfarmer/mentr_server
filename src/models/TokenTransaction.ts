import mongoose, { Document, Schema } from 'mongoose';

export interface ITokenTransaction extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'credit' | 'debit' | 'refund';
  amount: number;
  description: string;
  reference?: string;
  createdAt: Date;
}

const TokenTransactionSchema = new Schema<ITokenTransaction>({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['credit', 'debit', 'refund'], 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  description: { 
    type: String, 
    required: true 
  },
  reference: { 
    type: String 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
TokenTransactionSchema.index({ userId: 1, createdAt: -1 });
TokenTransactionSchema.index({ type: 1 });
TokenTransactionSchema.index({ reference: 1 });

export const TokenTransaction = mongoose.model<ITokenTransaction>('TokenTransaction', TokenTransactionSchema);
export default TokenTransaction;
