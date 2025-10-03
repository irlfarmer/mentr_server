import { Request } from 'express';

// User Types
export interface IUser {
  _id: string;
  email: string;
  linkedinId?: string;
  linkedinProfileUrl?: string;
  firstName: string;
  lastName: string;
  profileImage?: string;
  bio?: string;
  isVerified: boolean;
  verificationDate?: Date;
  verificationScore?: number;
  userType: 'mentor' | 'student' | 'both';
  skills: string[];
  hourlyRate?: number;
  coldMessageRate?: number;
  availability: IAvailability[];
  documents: IDocument[];
  timezone: string;
  mentraBalance?: number;
  createdAt: Date;
  updatedAt: Date;
}


export interface IWorkExperience {
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
}

export interface IEducation {
  school: string;
  degree: string;
  field: string;
  year: number;
  isCurrent?: boolean;
  documents?: Array<{
    name: string;
    url: string;
    type: string;
  }>;
}

export interface IDocument {
  _id: string;
  type: 'resume' | 'certificate' | 'transcript';
  url: string;
  name: string;
  uploadedAt: Date;
}

export interface IAvailability {
  day: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  timezone: string;
}

// Service Types
export interface IService {
  _id: string;
  mentorId: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  hourlyRate: number;
  duration: number; // in minutes
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Booking Types
export interface IBooking {
  _id: string;
  serviceId: string;
  mentorId: string;
  studentId: string;
  scheduledAt: Date;
  scheduledAtUTC: Date;
  scheduledAtLocal?: Date; // For availability responses
  mentorTimezone: string;
  studentTimezone: string;
  duration: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  amount: number;
  stripePaymentIntentId?: string;
  meetingUrl?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  // Populated fields
  service?: IService;
  mentor?: IUser;
  student?: IUser;
}

// Review Types
export interface IReview {
  _id: string;
  serviceId: string;
  studentId: string;
  mentorId: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

// Message Types
export interface IMessage {
  _id: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: 'text' | 'file' | 'image';
  messageType: 'warm' | 'cold';
  paymentStatus: 'free' | 'paid' | 'pending' | 'failed';
  paymentAmount: number;
  fileUrl?: string;
  isRead: boolean;
  createdAt: Date;
}

// Meeting Types
export interface IMeeting {
  _id: string;
  bookingId: string;
  dailyRoomName: string;
  dailyRoomUrl: string;
  startTime: Date;
  endTime?: Date;
  recordingUrl?: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Auth Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  userType: 'mentor' | 'student' | 'both';
}

export interface AuthState {
  user: IUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Request with User
export interface AuthRequest extends Request {
  user?: any; // Using any to accommodate both IUser and IUserDocument types
}

// JWT Payload
export interface JWTPayload {
  userId: string;
  email: string;
  userType: string;
  iat: number;
  exp: number;
}

// Referral Types
export interface IReferral {
  _id: string;
  referrerId: string;
  refereeId: string;
  referralCode: string;
  status: 'pending' | 'active' | 'inactive';
  totalEarnings: number;
  lastEarningDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IReferralCode {
  _id: string;
  userId: string;
  code: string;
  isActive: boolean;
  totalUses: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IReferralEarning {
  _id: string;
  referrerId: string;
  refereeId: string;
  referralId: string;
  sourceType: 'booking' | 'chat' | 'token_purchase';
  sourceId: string;
  amount: number;
  commissionRate: number;
  commissionAmount: number;
  status: 'pending' | 'paid' | 'cancelled';
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferralStats {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  totalEarnings: number;
  pendingEarnings: number;
  referrals: Array<{
    refereeName: string;
    refereeEmail: string;
    joinedAt: Date;
    totalSpent: number;
    earnings: number;
  }>;
}
