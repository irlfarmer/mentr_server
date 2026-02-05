import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { TokenTransaction } from '../models/TokenTransaction';
import { Booking } from '../models/Booking';
import { AuthRequest } from '../types';
import { StripeService, CreatePaymentIntentParams } from '../services/stripeService';
import { ReferralService } from '../services/referralService';

// Get user's token balance and recent transactions
export const getBalance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    const user = await User.findById(userId).select('mentraBalance');
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    // Get recent transactions
    const transactions = await TokenTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      data: {
        balance: user.mentraBalance,
        transactions
      }
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Create payment intent for token top-up
export const createTokenTopUpPaymentIntent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    const { amount } = req.body;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    if (!amount || amount <= 0) {
      res.status(400).json({
        success: false,
        error: 'Invalid amount'
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    // Create Stripe payment intent
    const paymentIntentParams: CreatePaymentIntentParams = {
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      bookingId: `token_topup_${userId}_${Date.now()}`,
      customerEmail: user.email,
      description: `Mentra Token Top-up - ${amount} tokens`
    };

    const paymentIntent = await StripeService.createPaymentIntent(paymentIntentParams);

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.clientSecret,
        paymentIntentId: paymentIntent.paymentIntentId,
        amount: amount
      }
    });
  } catch (error) {
    console.error('Create token top-up payment intent error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment intent'
    });
  }
};

// Confirm token top-up payment
export const confirmTokenTopUp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    const { paymentIntentId, amount } = req.body;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    if (!paymentIntentId || !amount) {
      res.status(400).json({
        success: false,
        error: 'Payment intent ID and amount are required'
      });
      return;
    }

    // Verify payment intent with Stripe
    const paymentIntent = await StripeService.getPaymentIntent(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      res.status(400).json({
        success: false,
        error: 'Payment not completed'
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    // Update user's token balance
    const newBalance = user.mentraBalance + amount;
    await User.findByIdAndUpdate(userId, { mentraBalance: newBalance });

    // Create transaction record
    const transaction = new TokenTransaction({
      userId,
      type: 'credit',
      amount,
      description: `Token top-up via Stripe`,
      reference: `stripe_${paymentIntentId}`
    });
    await transaction.save();

    // Record referral earning for token purchase
    await ReferralService.recordEarning(userId, 'token_purchase', (transaction._id as any).toString(), amount);

    res.json({
      success: true,
      message: `Successfully added ${amount} Mentra tokens to your account`,
      data: {
        newBalance,
        transaction: transaction
      }
    });
  } catch (error) {
    console.error('Confirm token top-up error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm payment'
    });
  }
};

// Get transaction history
export const getTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    const { page = 1, limit = 20 } = req.query;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const transactions = await TokenTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await TokenTransaction.countDocuments({ userId });
    const pages = Math.ceil(total / Number(limit));

    res.json({
      success: true,
      data: {
        transactions,
        total,
        pages
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Check if user has sufficient balance
export const checkBalance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    const { amount } = req.body;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    if (!amount || amount <= 0) {
      res.status(400).json({
        success: false,
        error: 'Invalid amount'
      });
      return;
    }

    const user = await User.findById(userId).select('mentraBalance');
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    const sufficient = user.mentraBalance >= amount;

    res.json({
      success: true,
      data: {
        sufficient,
        currentBalance: user.mentraBalance
      }
    });
  } catch (error) {
    console.error('Check balance error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Deduct tokens for cold message (internal function)
// Deduct tokens for cold message (internal function)
export const deductTokens = async (userId: string, amount: number, description: string): Promise<{ success: boolean; transactionId?: string }> => {
  try {
    const user = await User.findById(userId);
    if (!user || user.mentraBalance < amount) {
      return { success: false };
    }

    // Update balance
    const newBalance = user.mentraBalance - amount;
    await User.findByIdAndUpdate(userId, { mentraBalance: newBalance });

    // Create transaction record
    const transaction = new TokenTransaction({
      userId,
      type: 'debit',
      amount,
      description,
      reference: `cold_message_${Date.now()}`
    });
    await transaction.save();

    return { success: true, transactionId: (transaction._id as any).toString() };
  } catch (error) {
    console.error('Deduct tokens error:', error);
    return { success: false };
  }
};

// Get total token spend
export const getTotalSpend = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

     // Sum up all credit transactions (purchases)
    const tokenPurchases = await TokenTransaction.aggregate([
      { 
        $match: { 
          userId: new mongoose.Types.ObjectId(userId.toString()), 
          type: 'credit',
          reference: { $regex: /^stripe_/ }
        } 
      },
      { 
        $group: { 
          _id: null, 
          total: { $sum: '$amount' } 
        } 
      }
    ]);

    // Sum up all direct Stripe bookings
    const directBookings = await Booking.aggregate([
      {
        $match: {
          studentId: new mongoose.Types.ObjectId(userId.toString()),
          paymentMethod: 'stripe',
          paymentStatus: 'paid'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    const totalSpent = (tokenPurchases[0]?.total || 0) + (directBookings[0]?.total || 0);

    res.json({
      success: true,
      data: {
        totalSpent
      }
    });
  } catch (error) {
    console.error('Get total spend error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
