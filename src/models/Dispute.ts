import mongoose, { Document, Schema } from 'mongoose';

export interface IDispute extends Document {
  bookingId: mongoose.Types.ObjectId;
  menteeId: mongoose.Types.ObjectId;
  mentorId: mongoose.Types.ObjectId;
  reason: string;
  description: string;
  status: 'pending' | 'mentor_responded' | 'admin_review' | 'resolved' | 'dismissed';
  evidence: Array<{
    type: 'image' | 'video' | 'document' | 'text';
    url: string;
    description?: string;
    uploadedAt: Date;
  }>;
  mentorResponse?: {
    message: string;
    evidence?: Array<{
      type: 'image' | 'video' | 'document' | 'text';
      url: string;
      description?: string;
      uploadedAt: Date;
    }>;
    respondedAt: Date;
  };
  adminResolution?: {
    decision: 'refund_mentee' | 'pay_mentor' | 'partial_refund';
    amount?: number; // For partial refunds
    reason: string;
    resolvedAt: Date;
    adminId: mongoose.Types.ObjectId;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DisputeSchema = new Schema<IDispute>({
  bookingId: {
    type: Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  menteeId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  mentorId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    required: true,
    enum: [
      'session_not_conducted',
      'poor_quality',
      'inappropriate_behavior',
      'technical_issues',
      'misleading_description',
      'other'
    ]
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  status: {
    type: String,
    enum: ['pending', 'mentor_responded', 'admin_review', 'resolved', 'dismissed'],
    default: 'pending'
  },
  evidence: [{
    type: {
      type: String,
      enum: ['image', 'video', 'document', 'text'],
      required: true
    },
    url: {
      type: String,
      required: true
    },
    description: {
      type: String,
      maxlength: 200
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  mentorResponse: {
    message: {
      type: String,
      maxlength: 1000
    },
    evidence: [{
      type: {
        type: String,
        enum: ['image', 'video', 'document', 'text'],
        required: true
      },
      url: {
        type: String,
        required: true
      },
      description: {
        type: String,
        maxlength: 200
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    respondedAt: {
      type: Date
    }
  },
  adminResolution: {
    decision: {
      type: String,
      enum: ['refund_mentee', 'pay_mentor', 'partial_refund']
    },
    amount: {
      type: Number,
      min: 0
    },
    reason: {
      type: String,
      maxlength: 500
    },
    resolvedAt: {
      type: Date
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  }
}, {
  timestamps: true
});

// Index for efficient queries
DisputeSchema.index({ bookingId: 1 });
DisputeSchema.index({ menteeId: 1 });
DisputeSchema.index({ mentorId: 1 });
DisputeSchema.index({ status: 1 });
DisputeSchema.index({ createdAt: -1 });

export const Dispute = mongoose.model<IDispute>('Dispute', DisputeSchema);
