import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser, IEducation, IDocument, IAvailability } from '../types';

export interface IUserDocument extends Document {
  email: string;
  linkedinId?: string;
  linkedinProfileUrl?: string;
  firstName: string;
  lastName: string;
  password: string;
  profileImage?: string;
  bio?: string;
  isVerified: boolean;
  isEmailVerified: boolean;
  verificationDate?: Date;
  verificationScore?: number;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  userType: 'mentor' | 'student' | 'both' | 'admin';
  skills: string[];
  hourlyRate?: number;
  coldMessageRate?: number;
  minimumCancellationHours?: number; // Minimum hours before session for cancellation
  // Professional fields
  professionalHeadline?: string;
  currentCompany?: string;
  currentPosition?: string;
  workExperience?: Array<{
    company: string;
    position: string;
    description?: string;
    location?: string;
    startDate: {
      year: number;
      month?: number;
    };
    endDate?: {
      year: number;
      month?: number;
    };
    isCurrent: boolean;
    documents?: Array<{
      name: string;
      url: string;
      type: string;
    }>;
  }>;
  // Student-specific fields
  learningInterests?: string[];
  educationBackground?: Array<{
    school: string;
    degree: string;
    field: string;
    year: number;
    isCurrent?: boolean;
  }>;
  careerGoals?: {
    currentFocus?: string;
    professionalBackground?: string;
    longTermGoals?: string;
  };
  mentraBalance: number;
  // Mentor earnings tracking
  mentorEarnings?: {
    totalEarnings: number;
    sessionEarnings: number;
    messageEarnings: number;
    totalCompletedSessions: number;
    totalColdMessages: number;
    commissionTier: 'tier1' | 'tier2' | 'tier3' | 'tier4' | 'tier5' | 'tier6' | 'tier7' | 'tier8';
    lastTierUpdate: Date;
    monthlyEarnings: Array<{
      year: number;
      month: number;
      sessionEarnings: number;
      messageEarnings: number;
      totalEarnings: number;
      sessionsCompleted: number;
      coldMessages: number;
    }>;
  };
  // Stripe Connect for payouts
  stripeConnect?: {
    accountId?: string;
    accountStatus?: 'pending' | 'active' | 'restricted' | 'rejected';
    onboardingComplete?: boolean;
    payoutsEnabled?: boolean;
    chargesEnabled?: boolean;
    detailsSubmitted?: boolean;
    lastUpdated?: Date;
  };
  availability: IAvailability[];
  isOnboarded: boolean;
  isActive: boolean;
  isBanned: boolean;
  emailVerified: boolean;
  timezone: string;
  isOnline: boolean;
  lastSeen: Date;
  isAnonymous: boolean;
  anonymityReason?: string;
  createdAt: Date;
  updatedAt: Date;
  refreshTokens: Array<{
    token: string;
    expires: Date;
    createdAt: Date;
    createdByIp?: string;
  }>;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const EducationSchema = new Schema({
  school: { type: String, required: true },
  degree: { type: String, required: true },
  field: { type: String, required: true },
  year: { type: Number, required: true },
  isCurrent: { type: Boolean, default: false },
  documents: [{
    name: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, required: true }
  }]
});


const WorkExperienceSchema = new Schema({
  company: { type: String, required: true },
  position: { type: String, required: true },
  description: { type: String },
  location: { type: String },
  startDate: {
    year: { type: Number, required: true },
    month: { type: Number }
  },
  endDate: {
    year: { type: Number },
    month: { type: Number }
  },
  isCurrent: { type: Boolean, default: false },
  documents: [{
    name: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, required: true }
  }]
});


const DocumentSchema = new Schema<IDocument>({
  type: { 
    type: String, 
    enum: ['resume', 'certificate', 'transcript'], 
    required: true 
  },
  url: { type: String, required: true },
  name: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now }
});

const AvailabilitySchema = new Schema<IAvailability>({
  day: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  isAvailable: { type: Boolean, default: true },
  timezone: { type: String, required: true, default: 'UTC' }
});

const UserSchema = new Schema<IUserDocument>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  linkedinId: {
    type: String,
    sparse: true,
    unique: true
  },
  linkedinProfileUrl: {
    type: String
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  profileImage: {
    type: String
  },
  bio: {
    type: String,
    maxlength: 500
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  verificationDate: {
    type: Date
  },
  verificationScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  emailVerificationToken: {
    type: String
  },
  emailVerificationExpires: {
    type: Date
  },
  passwordResetToken: {
    type: String
  },
  passwordResetExpires: {
    type: Date
  },
  userType: {
    type: String,
    enum: ['mentor', 'student', 'both', 'admin'],
    required: true
  },
  skills: [{
    type: String,
    trim: true
  }],
  hourlyRate: {
    type: Number,
    min: 0
  },
  coldMessageRate: {
    type: Number,
    min: 0,
    default: 0
  },
  minimumCancellationHours: {
    type: Number,
    min: 1,
    max: 168, // Max 1 week
    default: 24
  },
  // Professional fields
  professionalHeadline: {
    type: String,
    trim: true
  },
  currentCompany: {
    type: String,
    trim: true
  },
  currentPosition: {
    type: String,
    trim: true
  },
  workExperience: [WorkExperienceSchema],
  // Student-specific fields
  learningInterests: [{
    type: String,
    trim: true
  }],
  educationBackground: [EducationSchema],
  careerGoals: {
    currentFocus: { type: String },
    professionalBackground: { type: String },
    longTermGoals: { type: String }
  },
  mentraBalance: {
    type: Number,
    min: 0,
    default: 0
  },
  // Mentor earnings tracking
  mentorEarnings: {
    totalEarnings: { type: Number, default: 0, min: 0 },
    sessionEarnings: { type: Number, default: 0, min: 0 },
    messageEarnings: { type: Number, default: 0, min: 0 },
    totalCompletedSessions: { type: Number, default: 0, min: 0 },
    totalColdMessages: { type: Number, default: 0, min: 0 },
    commissionTier: { 
      type: String, 
      enum: ['tier1', 'tier2', 'tier3', 'tier4', 'tier5', 'tier6', 'tier7', 'tier8'],
      default: 'tier1'
    },
    lastTierUpdate: { type: Date, default: Date.now },
    monthlyEarnings: [{
      year: { type: Number, required: true },
      month: { type: Number, required: true, min: 1, max: 12 },
      sessionEarnings: { type: Number, default: 0, min: 0 },
      messageEarnings: { type: Number, default: 0, min: 0 },
      totalEarnings: { type: Number, default: 0, min: 0 },
      sessionsCompleted: { type: Number, default: 0, min: 0 },
      coldMessages: { type: Number, default: 0, min: 0 }
    }]
  },
  // Stripe Connect for payouts
  stripeConnect: {
    accountId: { type: String },
    accountStatus: { 
      type: String, 
      enum: ['pending', 'active', 'restricted', 'rejected'],
      default: 'pending'
    },
    onboardingComplete: { type: Boolean, default: false },
    payoutsEnabled: { type: Boolean, default: false },
    chargesEnabled: { type: Boolean, default: false },
    detailsSubmitted: { type: Boolean, default: false },
    lastUpdated: { type: Date, default: Date.now }
  },
  availability: [AvailabilitySchema],
  isOnboarded: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  anonymityReason: {
    type: String,
    maxlength: 200
  }
}, {
  timestamps: true
});

// Refresh Token Schema (embedded in User)
// We don't need a separate schema definition if it's simple object structure in array, 
// but defining it ensures types.
// Actually, let's just add it to UserSchema directly as we did in interface.
UserSchema.add({
  refreshTokens: [{
    token: { type: String, required: true },
    expires: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
    createdByIp: { type: String }
  }]
});

// Additional indexes (email and linkedinId already have unique indexes)
UserSchema.index({ userType: 1 });
UserSchema.index({ isVerified: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ isBanned: 1 });
UserSchema.index({ skills: 1 });

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtual fields are serialized
UserSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret: any) {
    delete ret.password;
    delete ret.emailVerificationToken;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    return ret;
  }
});

// Force clear any cached User model to prevent schema conflicts
if (mongoose.models.User) {
  delete mongoose.models.User;
}

export const User = mongoose.model<IUserDocument>('User', UserSchema);
