import mongoose, { Document, Schema } from 'mongoose';

export interface IVideoCall {
  bookingId: mongoose.Types.ObjectId;
  roomName: string;
  roomUrl: string;
  mentorId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  scheduledAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  duration?: number; // in minutes
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'recording';
  recordingUrl?: string;
  recordingId?: string;
  transcriptionUrl?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IVideoCallDocument extends IVideoCall, Document {}

const VideoCallSchema = new Schema<IVideoCallDocument>(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      unique: true,
    },
    roomName: {
      type: String,
      required: true,
      unique: true,
    },
    roomUrl: {
      type: String,
      required: true,
    },
    mentorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    startedAt: {
      type: Date,
    },
    endedAt: {
      type: Date,
    },
    duration: {
      type: Number,
    },
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show', 'recording'],
      default: 'scheduled',
    },
    recordingUrl: {
      type: String,
    },
    recordingId: {
      type: String,
    },
    transcriptionUrl: {
      type: String,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
VideoCallSchema.index({ mentorId: 1 });
VideoCallSchema.index({ studentId: 1 });
VideoCallSchema.index({ scheduledAt: 1 });
VideoCallSchema.index({ status: 1 });

// Pre-save middleware to generate room name
VideoCallSchema.pre<IVideoCallDocument>('save', function (next) {
  if (!this.roomName) {
    // Generate unique room name
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    this.roomName = `mentr-${this.bookingId}-${timestamp}-${randomStr}`;
  }
  next();
});

// Methods
VideoCallSchema.methods.isActive = function (): boolean {
  return this.status === 'in_progress';
};

VideoCallSchema.methods.isScheduled = function (): boolean {
  return this.status === 'scheduled';
};

VideoCallSchema.methods.isCompleted = function (): boolean {
  return this.status === 'completed';
};

VideoCallSchema.methods.canJoin = function (userId: string): boolean {
  // Handle both ObjectId and populated object cases
  const mentorIdStr = this.mentorId._id ? this.mentorId._id.toString() : this.mentorId.toString();
  const studentIdStr = this.studentId._id ? this.studentId._id.toString() : this.studentId.toString();
  const isUserMentorOrStudent = (mentorIdStr === userId || studentIdStr === userId);
  const isStatusValid = (this.status === 'scheduled' || this.status === 'in_progress');
  const result = isUserMentorOrStudent && isStatusValid;
  
  
  return result;
};

VideoCallSchema.methods.getDurationInMinutes = function (): number {
  if (this.startedAt && this.endedAt) {
    return Math.round((this.endedAt.getTime() - this.startedAt.getTime()) / (1000 * 60));
  }
  return 0;
};

export const VideoCall = mongoose.model<IVideoCallDocument>('VideoCall', VideoCallSchema);
export default VideoCall;
