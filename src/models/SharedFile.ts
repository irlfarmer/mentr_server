import mongoose, { Schema, Document } from 'mongoose';

export interface ISharedFile extends Document {
  meetingId: string;
  uploaderId: mongoose.Types.ObjectId;
  fileName: string;
  fileUrl: string;
  publicId: string; // Cloudinary public_id for deletion
  resourceType: string; // 'raw', 'image', 'video', 'auto'
  fileSize: number;
  fileType: string; // MIME type
  expiresAt: Date;
  createdAt: Date;
}

const SharedFileSchema: Schema = new Schema({
  meetingId: {
    type: String,
    required: true,
    index: true
  },
  uploaderId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  publicId: {
    type: String,
    required: true
  },
  resourceType: {
    type: String,
    required: true,
    default: 'auto'
  },
  fileSize: {
    type: Number
  },
  fileType: {
    type: String
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true // Indexed for efficient cron cleanup
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const SharedFile = mongoose.model<ISharedFile>('SharedFile', SharedFileSchema);
