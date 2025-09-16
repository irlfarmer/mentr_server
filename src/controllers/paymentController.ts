import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import { StripeService, CreatePaymentIntentParams } from '../services/stripeService';
import { Booking } from '../models/Booking';
import { User } from '../models/User';

// Create payment intent for a booking or amount
export const createPaymentIntent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    const { bookingId, amount, currency = 'usd' } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    // Support both booking-based and amount-based payment intents
    if (!bookingId && !amount) {
      res.status(400).json({
        success: false,
        error: 'Either bookingId or amount is required'
      });
      return;
    }

    let paymentIntentParams: CreatePaymentIntentParams;
    let finalAmount: number;

    if (bookingId) {
      // Booking-based payment intent
      const booking = await Booking.findById(bookingId)
        .populate([
          { path: 'serviceId', select: 'title' },
          { path: 'mentorId', select: 'firstName lastName' },
          { path: 'studentId', select: 'firstName lastName email' }
        ]);

      if (!booking) {
        res.status(404).json({
          success: false,
          error: 'Booking not found'
        });
        return;
      }

      // Check if user is authorized to pay for this booking
      if (booking.studentId.toString() !== userId.toString()) {
        res.status(403).json({
          success: false,
          error: 'Not authorized to pay for this booking'
        });
        return;
      }

      // Check if booking is already paid
      if (booking.paymentStatus === 'paid') {
        res.status(400).json({
          success: false,
          error: 'Booking is already paid'
        });
        return;
      }

      const student = booking.studentId as any;
      const service = booking.serviceId as any;
      const mentor = booking.mentorId as any;

      paymentIntentParams = {
        amount: Math.round(booking.amount * 100), // Convert to cents
        currency: 'usd',
        bookingId: (booking as any)._id.toString(),
        customerEmail: student.email,
        description: `${service.title} session with ${mentor.firstName} ${mentor.lastName}`
      };
      finalAmount = booking.amount;
    } else {
      // Amount-based payment intent
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      paymentIntentParams = {
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency,
        bookingId: 'temp_' + Date.now(), // Temporary ID for amount-based payments
        customerEmail: user.email,
        description: 'Service payment'
      };
      finalAmount = amount;
    }

    const paymentIntent = await StripeService.createPaymentIntent(paymentIntentParams);

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.clientSecret,
        paymentIntentId: paymentIntent.paymentIntentId,
        amount: finalAmount,
        currency: currency
      }
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment intent'
    });
  }
};

// Confirm payment and update booking status
export const confirmPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    const { bookingId, paymentIntentId } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    if (!bookingId || !paymentIntentId) {
      res.status(400).json({
        success: false,
        error: 'Booking ID and Payment Intent ID are required'
      });
      return;
    }

    // Get the booking
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
      return;
    }

    // Check if user is authorized
    if (booking.studentId.toString() !== userId.toString()) {
      res.status(403).json({
        success: false,
        error: 'Not authorized to update this booking'
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

    // Update booking payment status
    booking.paymentStatus = 'paid';
    booking.stripePaymentIntentId = paymentIntentId;
    await booking.save();

    res.json({
      success: true,
      data: booking,
      message: 'Payment confirmed successfully'
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm payment'
    });
  }
};

// Process Stripe webhook
export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

    if (!signature) {
      res.status(400).json({
        success: false,
        error: 'Missing stripe signature'
      });
      return;
    }

    const event = StripeService.verifyWebhookSignature(
      req.body,
      signature,
      endpointSecret
    );

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      
      case 'charge.refunded':
        await handleRefund(event.data.object);
        break;
      
      default:

    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({
      success: false,
      error: 'Webhook error'
    });
  }
};

// Handle successful payment
const handlePaymentSucceeded = async (paymentIntent: any) => {
  try {
    const bookingId = paymentIntent.metadata.bookingId;
    
    if (bookingId) {
      const booking = await Booking.findById(bookingId);
      if (booking) {
        // Update payment status
        booking.paymentStatus = 'paid';
        booking.stripePaymentIntentId = paymentIntent.id;
        
        // Auto-confirm booking after successful payment
        if (booking.status === 'pending') {
          booking.status = 'confirmed';
        }
        
        await booking.save();
      }
    }
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
};

// Handle failed payment
const handlePaymentFailed = async (paymentIntent: any) => {
  try {
    const bookingId = paymentIntent.metadata.bookingId;
    
    if (bookingId) {
      const booking = await Booking.findById(bookingId);
      if (booking) {
        booking.paymentStatus = 'pending';
        await booking.save();
        

      }
    }
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
};

// Handle refund
const handleRefund = async (charge: any) => {
  try {
    const paymentIntentId = charge.payment_intent;
    
    if (paymentIntentId) {
      const booking = await Booking.findOne({ stripePaymentIntentId: paymentIntentId });
      if (booking) {
        booking.paymentStatus = 'refunded';
        await booking.save();
        

      }
    }
  } catch (error) {
    console.error('Error handling refund:', error);
  }
};
