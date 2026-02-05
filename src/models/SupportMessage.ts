import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISupportMessage extends Document {
  senderId?: Types.ObjectId; // For authenticated users
  guestEmail?: string;       // For guests
  guestName?: string;        // For guests
  content: string;
  isAdmin: boolean;          // Is this a response from support staff?
  adminId?: Types.ObjectId;  // The admin who responded
  status: 'pending' | 'resolved' | 'archived';
  conversationId: string;    // Groups messages (for guests: email-based, for users: userId-based)
  createdAt: Date;
  updatedAt: Date;
}

const SupportMessageSchema = new Schema<ISupportMessage>(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    guestEmail: {
      type: String,
      required: false,
      trim: true,
      lowercase: true,
    },
    guestName: {
      type: String,
      required: false,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    status: {
      type: String,
      enum: ['pending', 'resolved', 'archived'],
      default: 'pending',
    },
    conversationId: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const SupportMessage = mongoose.model<ISupportMessage>('SupportMessage', SupportMessageSchema);
