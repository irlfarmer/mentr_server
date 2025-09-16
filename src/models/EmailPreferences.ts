import mongoose, { Document, Schema } from 'mongoose';

export interface IEmailPreferences extends Document {
  userId: mongoose.Types.ObjectId;
  email: string;
  isUnsubscribed: boolean;
  unsubscribeToken: string;
  unsubscribeDate?: Date;
  categories: {
    booking: boolean;
    reschedule: boolean;
    chat: boolean;
    payout: boolean;
    dispute: boolean;
    system: boolean;
    verification: boolean;
    marketing: boolean;
  };
  frequency: 'immediate' | 'daily' | 'weekly' | 'never';
  lastEmailSent?: Date;
  emailCount: number;
  bounceCount: number;
  complaintCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EmailPreferencesSchema = new Schema<IEmailPreferences>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    index: true
  },
  isUnsubscribed: {
    type: Boolean,
    default: false
  },
  unsubscribeToken: {
    type: String,
    required: true,
    unique: true
  },
  unsubscribeDate: {
    type: Date
  },
  categories: {
    booking: {
      type: Boolean,
      default: true
    },
    reschedule: {
      type: Boolean,
      default: true
    },
    chat: {
      type: Boolean,
      default: true
    },
    payout: {
      type: Boolean,
      default: true
    },
    dispute: {
      type: Boolean,
      default: true
    },
    system: {
      type: Boolean,
      default: true
    },
    verification: {
      type: Boolean,
      default: true
    },
    marketing: {
      type: Boolean,
      default: false
    }
  },
  frequency: {
    type: String,
    enum: ['immediate', 'daily', 'weekly', 'never'],
    default: 'immediate'
  },
  lastEmailSent: {
    type: Date
  },
  emailCount: {
    type: Number,
    default: 0
  },
  bounceCount: {
    type: Number,
    default: 0
  },
  complaintCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
EmailPreferencesSchema.index({ email: 1, isActive: 1 });
EmailPreferencesSchema.index({ isUnsubscribed: 1, isActive: 1 });

export const EmailPreferences = mongoose.model<IEmailPreferences>('EmailPreferences', EmailPreferencesSchema);
