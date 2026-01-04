import mongoose, { Document, Schema } from 'mongoose';

export interface IService {
  mentorId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  category: string;
  tags: string[];
  hourlyRate: number;
  duration: number; // in minutes
  images: string[]; // Array of Cloudinary URLs
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IServiceDocument extends IService, Document {}

const ServiceSchema = new Schema<IServiceDocument>({
  mentorId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  category: {
    type: String,
    required: true,
    enum: [
      'academic-tutoring',
      'career-guidance',
      'interview-prep',
      'skill-development',
      'mentorship',
      'consulting',
      'other'
    ]
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  hourlyRate: {
    type: Number,
    required: true,
    min: 0,
    max: 1000
  },
  duration: {
    type: Number,
    required: true,
    min: 15,
    max: 480, // 8 hours max
    default: 60
  },
  images: [{
    type: String,
    default: []
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
});

// Index for search functionality
ServiceSchema.index({
  title: 'text',
  description: 'text',
  tags: 'text'
});

// Index for filtering
ServiceSchema.index({ category: 1, isActive: 1 });
ServiceSchema.index({ hourlyRate: 1, isActive: 1 });

// Virtual for mentor info
ServiceSchema.virtual('mentor', {
  ref: 'User',
  localField: 'mentorId',
  foreignField: '_id',
  justOne: true
});

// Ensure virtuals are included in queries
ServiceSchema.set('toObject', { virtuals: true });

// Ensure virtuals are included in JSON output
ServiceSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret: any) {
    delete ret.__v;
    return ret;
  }
});

export const Service = mongoose.model<IServiceDocument>('Service', ServiceSchema);
