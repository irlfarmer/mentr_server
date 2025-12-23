import mongoose, { Document, Schema, Types } from "mongoose";

// Extended Message interface for the model
interface IMessageDocument extends Document {
  _id: Types.ObjectId;
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  content: string;
  type: "text" | "file" | "image";
  messageType: "warm" | "cold";
  paymentStatus: 'free' | 'paid' | 'pending' | 'failed' | 'refunded';
  paymentAmount: number;
  fileUrl?: string; // Legacy
  attachments?: Array<{
    type: 'image' | 'file';
    url: string;
    name: string;
    publicId?: string;
  }>;
  isRead: boolean;
  replied?: boolean;
  tokensDeducted?: number;
  tokenTransactionId?: string;
  isColdMessage?: boolean;
  conversationId: string;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessageDocument>(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["text", "file", "image"],
      default: "text",
    },
    messageType: {
      type: String,
      enum: ["warm", "cold"],
      default: "warm",
    },
    paymentStatus: {
      type: String,
      enum: ['free', 'paid', 'pending', 'failed', 'refunded'],
      default: 'free',
    },
    paymentAmount: {
      type: Number,
      default: 0,
    },
    fileUrl: {
      type: String,
      required: false,
    },
    attachments: [{
      type: { type: String, enum: ['image', 'file'] },
      url: String,
      name: String,
      publicId: String
    }],
    isRead: {
      type: Boolean,
      default: false,
    },
    replied: {
      type: Boolean,
      default: false,
    },
    tokensDeducted: {
      type: Number,
      default: 0,
    },
    tokenTransactionId: {
      type: String,
      required: false,
    },
    isColdMessage: {
      type: Boolean,
      default: false,
    },
    conversationId: {
      type: String,
      required: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Create compound index for efficient querying
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1, receiverId: 1 });

// Generate conversationId from sender and receiver IDs
MessageSchema.pre<IMessageDocument>("save", function (next) {
  // Always generate conversationId if not present
  if (!this.conversationId && this.senderId && this.receiverId) {
    const ids = [this.senderId.toString(), this.receiverId.toString()].sort();
    this.conversationId = ids.join("_");
  }
  next();
});

export default mongoose.model<IMessageDocument>("Message", MessageSchema);
