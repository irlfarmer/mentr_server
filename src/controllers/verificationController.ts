import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import { User } from '../models/User';
import emailService from '../services/emailService';
import crypto from 'crypto';

// Generate verification token
const generateVerificationToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

import { StripeService } from '../services/stripeService';
import VerificationRequest from '../models/VerificationRequest';

// Initialize verification request (create payment intent)
export const initializeVerification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    // Check if user already has a pending or approved request
    const existingRequest = await VerificationRequest.findOne({
      userId,
      status: { $in: ['pending_review', 'approved'] }
    });

    if (existingRequest) {
      res.status(400).json({
        success: false,
        error: 'You already have a verification request in progress or approved'
      });
      return;
    }

    // Create Stripe Payment Intent for $25
    const amount = 25;
    const paymentIntent = await StripeService.createPaymentIntent({
      amount: amount * 100, // cents
      currency: 'usd',
      description: 'Mentr Verification Badge Fee',
      customerEmail: (req.user as any).email,
      bookingId: `verification_${userId}_${Date.now()}` // Using bookingId field for reference
    });

    // Create preliminary request record
    const request = new VerificationRequest({
      userId,
      stripePaymentId: paymentIntent.paymentIntentId,
      status: 'pending_payment',
      documents: []
    });

    await request.save();

    res.json({
      success: true,
      data: {
        requestId: request._id,
        clientSecret: paymentIntent.clientSecret,
        amount
      }
    });

  } catch (error) {
    console.error('Error initializing verification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize verification'
    });
  }
};

// Verify payment and update request status
export const verifyVerificationPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    const { requestId, paymentIntentId } = req.body;

    if (!userId || !requestId || !paymentIntentId) {
       res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
      return;
    }

    const request = await VerificationRequest.findOne({ _id: requestId, userId });
    
    if (!request) {
       res.status(404).json({
        success: false,
        error: 'Verification request not found'
      });
      return;
    }

    // Verify with Stripe
    const paymentIntent = await StripeService.getPaymentIntent(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      if (request.stripePaymentId !== paymentIntentId) {
         res.status(400).json({ success: false, error: 'Payment ID mismatch' });
         return;
      }

      await request.save();

      res.json({
        success: true,
        message: 'Payment verified'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Payment not successful'
      });
    }

  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment'
    });
  }
};

// Upload verification documents
export const uploadVerificationDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    const { requestId, documents } = req.body; // Expecting array of { name, url, type }

    if (!userId || !requestId || !documents || !Array.isArray(documents)) {
       res.status(400).json({
        success: false,
        error: 'Missing required fields or invalid documents format'
      });
      return;
    }

    const request = await VerificationRequest.findOne({ _id: requestId, userId });
    
    if (!request) {
       res.status(404).json({
        success: false,
        error: 'Verification request not found'
      });
      return;
    }

    // Update documents and status
    request.documents = documents;
    request.status = 'pending_review'; // Now ready for admin review
    await request.save();

    res.json({
      success: true,
      message: 'Documents uploaded successfully. Application is under review.'
    });

  } catch (error) {
    console.error('Error uploading documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload documents'
    });
  }
};

// Send verification email
export const sendVerificationEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Email is required'
      });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    if (user.isEmailVerified) {
      res.status(400).json({
        success: false,
        error: 'Email is already verified'
      });
      return;
    }

    // Generate verification token
    const verificationToken = generateVerificationToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Save token to user
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = verificationExpires;
    await user.save();

    // Create verification link
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    // Send verification email
    const emailSent = await emailService.sendVerificationEmail({
      name: user.firstName,
      email: user.email,
      verificationLink
    });

    if (!emailSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to send verification email'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Verification email sent successfully'
    });
  } catch (error) {
    console.error('Error sending verification email:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Verify email with token
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        error: 'Verification token is required'
      });
      return;
    }

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!user) {
      res.status(400).json({
        success: false,
        error: 'Invalid or expired verification token'
      });
      return;
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.verificationDate = new Date();
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isVerified: user.isVerified
        }
      }
    });
  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Resend verification email
export const resendVerificationEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Email is required'
      });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    if (user.isVerified) {
      res.status(400).json({
        success: false,
        error: 'Email is already verified'
      });
      return;
    }

    // Check if there's a recent verification email (rate limiting)
    const recentVerification = user.emailVerificationExpires && 
      user.emailVerificationExpires > new Date(Date.now() - 5 * 60 * 1000); // 5 minutes

    if (recentVerification) {
      res.status(429).json({
        success: false,
        error: 'Please wait 5 minutes before requesting another verification email'
      });
      return;
    }

    // Generate new verification token
    const verificationToken = generateVerificationToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Save token to user
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = verificationExpires;
    await user.save();

    // Create verification link
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    // Send verification email
    const emailSent = await emailService.sendVerificationEmail({
      name: user.firstName,
      email: user.email,
      verificationLink
    });

    if (!emailSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to send verification email'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Verification email sent successfully'
    });
  } catch (error) {
    console.error('Error resending verification email:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Check verification status
export const checkVerificationStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.query;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Email is required'
      });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        isVerified: user.isVerified,
        verificationDate: user.verificationDate
      }
    });
  } catch (error) {
    console.error('Error checking verification status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
