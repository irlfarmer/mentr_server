import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'email' | 'push' | 'in_app';
  category: 'booking' | 'reschedule' | 'chat' | 'payout' | 'dispute' | 'system' | 'verification';
  title: string;
  message: string;
  data?: any; // Additional data for the notification
  isRead: boolean;
  isSent: boolean;
  sentAt?: Date;
  readAt?: Date;
  scheduledFor?: Date; // For scheduled notifications
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['email', 'push', 'in_app'],
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: ['booking', 'reschedule', 'chat', 'payout', 'dispute', 'system', 'verification'],
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  data: {
    type: Schema.Types.Mixed,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  isSent: {
    type: Boolean,
    default: false,
    index: true
  },
  sentAt: {
    type: Date,
    index: true
  },
  readAt: {
    type: Date
  },
  scheduledFor: {
    type: Date,
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  retryCount: {
    type: Number,
    default: 0,
    min: 0
  },
  maxRetries: {
    type: Number,
    default: 3,
    min: 0
  },
  errorMessage: {
    type: String,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Compound indexes for efficient querying
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ userId: 1, category: 1 });
NotificationSchema.index({ status: 1, scheduledFor: 1 });
NotificationSchema.index({ type: 1, status: 1 });
NotificationSchema.index({ createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
