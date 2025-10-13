import { User } from '../models/User';
import { Booking } from '../models/Booking';
import { TokenTransaction } from '../models/TokenTransaction';
import { Service } from '../models/Service';

export class TokenPaymentService {
  // Process token payment for a booking
  static async processTokenPayment(
    bookingId: string,
    userId: string,
    amount: number
  ): Promise<{ success: boolean; error?: string; transactionId?: string }> {
    try {
      // Start a session for transaction
      const session = await User.startSession();
      
      try {
        console.log('Token payment - Starting transaction for booking:', bookingId);
        await session.withTransaction(async () => {
          // Get user and booking
          const user = await User.findById(userId).session(session);
          const booking = await Booking.findById(bookingId).session(session);
          
          if (!user) {
            throw new Error('Student not found');
          }
          
          if (!booking) {
            throw new Error('Booking not found');
          }
          
          // Check if booking belongs to user
          if (booking.studentId.toString() !== userId.toString()) {
            throw new Error('Unauthorized: Booking does not belong to user');
          }
          
          // Check if booking is already paid
          if (booking.paymentStatus === 'paid') {
            throw new Error('Booking is already paid');
          }
          
          // Check if user has sufficient token balance
          if (user.mentraBalance < amount) {
            throw new Error('Insufficient token balance');
          }
          
          // Deduct tokens from user's balance
          user.mentraBalance -= amount;
          await user.save({ session });
          
          // Create token transaction record
          const transaction = new TokenTransaction({
            userId: userId,
            type: 'debit',
            amount: amount,
            description: `Booking payment for ${booking.serviceId}`,
            reference: `booking_${bookingId}`
          });
          await transaction.save({ session });
          
          // Update booking payment status and status
          booking.paymentStatus = 'paid';
          booking.paymentMethod = 'tokens';
          booking.status = 'confirmed'; // Auto-confirm when paid with tokens
          await booking.save({ session });
          

          
          return { success: true, transactionId: (transaction._id as any).toString() };
        });
        
        return { success: true };
      } finally {
        await session.endSession();
      }
    } catch (error: any) {
      console.error('Token payment error:', error);
      return { 
        success: false, 
        error: error.message || 'Token payment failed' 
      };
    }
  }
  
  // Refund tokens for a cancelled booking
  static async refundTokenPayment(
    bookingId: string,
    amount: number,
    reason: string = 'Booking cancelled'
  ): Promise<{ success: boolean; error?: string; transactionId?: string }> {
    try {
      const session = await User.startSession();
      
      try {
        await session.withTransaction(async () => {
          // Get booking
          const booking = await Booking.findById(bookingId).session(session);
          
          if (!booking) {
            throw new Error('Booking not found');
          }
          
          // Check if booking was paid with tokens
          if (booking.paymentMethod !== 'tokens') {
            throw new Error('Booking was not paid with tokens');
          }
          
          // Check if booking was actually paid
          if (booking.paymentStatus !== 'paid') {
            throw new Error('Booking was not paid, no refund needed');
          }
          
          // Get user
          const user = await User.findById(booking.studentId).session(session);
          if (!user) {
            throw new Error('User not found');
          }
          
          // Add tokens back to user's balance
          user.mentraBalance += amount;
          await user.save({ session });
          
          // Create refund transaction record
          const transaction = new TokenTransaction({
            userId: booking.studentId,
            type: 'credit',
            amount: amount,
            description: `Refund for cancelled booking: ${reason}`,
            reference: `booking_refund_${bookingId}`
          });
          await transaction.save({ session });
          
          // Update booking refund status
          if (!booking.refund) {
            booking.refund = {
              status: 'processed',
              type: 'tokens',
              amount: amount,
              processedAt: new Date(),
              reason: reason
            };
          } else {
            booking.refund.status = 'processed';
            booking.refund.processedAt = new Date();
            booking.refund.reason = reason;
          }
          
          await booking.save({ session });
          
          return { success: true, transactionId: (transaction._id as any).toString() };
        });
        
        return { success: true };
      } finally {
        await session.endSession();
      }
    } catch (error: any) {
      console.error('Token refund error:', error);
      return { 
        success: false, 
        error: error.message || 'Token refund failed' 
      };
    }
  }
  
  // Check if user has sufficient tokens for a booking
  static async checkTokenBalance(
    userId: string,
    amount: number
  ): Promise<{ sufficient: boolean; currentBalance: number; required: number }> {
    try {
      const user = await User.findById(userId).select('mentraBalance');
      
      if (!user) {
        return { sufficient: false, currentBalance: 0, required: amount };
      }
      
      return {
        sufficient: user.mentraBalance >= amount,
        currentBalance: user.mentraBalance,
        required: amount
      };
    } catch (error) {
      console.error('Check token balance error:', error);
      return { sufficient: false, currentBalance: 0, required: amount };
    }
  }
  
  // Get token transaction history for bookings
  static async getBookingTokenHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ transactions: any[]; total: number }> {
    try {
      const transactions = await TokenTransaction.find({
        userId,
        reference: { $regex: /^booking/ }
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean();
      
      const total = await TokenTransaction.countDocuments({
        userId,
        reference: { $regex: /^booking/ }
      });
      
      return { transactions, total };
    } catch (error) {
      console.error('Get booking token history error:', error);
      return { transactions: [], total: 0 };
    }
  }
}
