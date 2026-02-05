import mongoose, { Schema, Document } from 'mongoose';

export interface IReport extends Document {
  reporterId: mongoose.Types.ObjectId;
  reportedId: mongoose.Types.ObjectId;
  reportedModel: 'User' | 'Service';
  reason: string;
  description: string;
  status: 'pending' | 'resolved' | 'dismissed';
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<IReport>(
  {
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    reportedId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: 'reportedModel',
      index: true
    },
    reportedModel: {
      type: String,
      required: true,
      enum: ['User', 'Service']
    },
    reason: {
      type: String,
      required: true,
      enum: [
        'inappropriate_content',
        'spam',
        'harassment',
        'false_information',
        'scam',
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
      enum: ['pending', 'resolved', 'dismissed'],
      default: 'pending',
      index: true
    },
    adminNotes: {
      type: String,
      maxlength: 2000
    }
  },
  {
    timestamps: true
  }
);

// Indexes for efficient querying
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reportedModel: 1, reportedId: 1 });

export const Report = mongoose.model<IReport>('Report', reportSchema);
