import { Referral, IReferral } from '../models/Referral';
import { ReferralCode, IReferralCode } from '../models/ReferralCode';
import { ReferralEarning, IReferralEarning } from '../models/ReferralEarning';
import { TokenTransaction } from '../models/TokenTransaction';
import { User } from '../models/User';
import mongoose from 'mongoose';

export class ReferralService {
  /**
   * Generate a unique referral code for a user
   */
  static async generateReferralCode(userId: string): Promise<{ success: boolean; code?: string; error?: string }> {
    try {
      // Check if user already has a referral code
      const existingCode = await ReferralCode.findOne({ userId });
      if (existingCode) {
        return { success: true, code: existingCode.code };
      }

      // Generate a unique code
      let code: string;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!isUnique && attempts < maxAttempts) {
        // Generate code from user's name or random
        const user = await User.findById(userId);
        if (user) {
          const namePart = user.firstName?.substring(0, 3).toUpperCase() || 'REF';
          const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
          code = `${namePart}${randomPart}`;
        } else {
          code = Math.random().toString(36).substring(2, 8).toUpperCase();
        }

        const existing = await ReferralCode.findOne({ code });
        if (!existing) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        return { success: false, error: 'Unable to generate unique referral code' };
      }

      // Create the referral code
      const referralCode = new ReferralCode({
        userId,
        code: code!
      });

      await referralCode.save();

      return { success: true, code: code! };
    } catch (error) {
      console.error('Error generating referral code:', error);
      return { success: false, error: 'Failed to generate referral code' };
    }
  }

  /**
   * Validate and process a referral code during signup
   */
  static async processReferralCode(referralCode: string, newUserId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Find the referral code
      const codeRecord = await ReferralCode.findOne({ code: referralCode.toUpperCase(), isActive: true });
      
      if (!codeRecord) {
        return { success: false, error: 'Invalid referral code' };
      }

      // Check if user is trying to use their own code
      if (codeRecord.userId.toString() === newUserId) {
        return { success: false, error: 'Cannot use your own referral code' };
      }

      // Check if user already has a referral
      const existingReferral = await Referral.findOne({ refereeId: newUserId });
      
      if (existingReferral) {
        return { success: false, error: 'User already has a referral' };
      }

      // Create referral relationship
      const referral = new Referral({
        referrerId: codeRecord.userId,
        refereeId: newUserId,
        referralCode: referralCode.toUpperCase(),
        status: 'active'
      });

      await referral.save();

      // Update referral code usage count
      await ReferralCode.findByIdAndUpdate(codeRecord._id, {
        $inc: { totalUses: 1 }
      });

      return { success: true };
    } catch (error) {
      console.error('Error processing referral code:', error);
      return { success: false, error: 'Failed to process referral code' };
    }
  }

  /**
   * Record earnings from a transaction
   */
  static async recordEarning(
    refereeId: string,
    sourceType: 'booking' | 'chat' | 'token_purchase',
    sourceId: string,
    amount: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Find the referral relationship
      const referral = await Referral.findOne({ refereeId, status: 'active' });
      if (!referral) {
        return { success: true }; // No referral, no earnings to record
      }

      // Calculate commission (1% of the amount)
      const commissionRate = 0.01;
      const commissionAmount = Math.round(amount * commissionRate * 100) / 100; // Round to 2 decimal places

      if (commissionAmount <= 0) {
        return { success: true }; // No commission to record
      }

      // Check if earning already exists for this source
      const existingEarning = await ReferralEarning.findOne({
        sourceId,
        sourceType
      });

      if (existingEarning) {
        return { success: true }; // Already recorded
      }

      // Create referral earning
      const earning = new ReferralEarning({
        referrerId: referral.referrerId,
        refereeId: referral.refereeId,
        referralId: referral._id,
        sourceType,
        sourceId,
        amount,
        commissionRate,
        commissionAmount,
        status: 'pending'
      });

      await earning.save();

      // Update referral total earnings
      await Referral.findByIdAndUpdate(referral._id, {
        $inc: { totalEarnings: commissionAmount },
        lastEarningDate: new Date()
      });

      return { success: true };
    } catch (error) {
      console.error('Error recording referral earning:', error);
      return { success: false, error: 'Failed to record referral earning' };
    }
  }

  /**
   * Process pending earnings and convert to tokens
   */
  static async processPendingEarnings(userId: string): Promise<{ success: boolean; totalProcessed?: number; error?: string }> {
    try {
      const session = await mongoose.startSession();
      
      let result = { success: true, totalProcessed: 0 };
      
      await session.withTransaction(async () => {
        // Find all pending earnings for this user
        const pendingEarnings = await ReferralEarning.find({
          referrerId: userId,
          status: 'pending'
        }).session(session);

        if (pendingEarnings.length === 0) {
          result = { success: true, totalProcessed: 0 };
          return;
        }

        let totalAmount = 0;

        // Process each earning
        for (const earning of pendingEarnings) {
          totalAmount += earning.commissionAmount;

          // Update earning status
          await ReferralEarning.findByIdAndUpdate(
            earning._id,
            { status: 'paid', paidAt: new Date() },
            { session }
          );
        }

        // Add tokens to user's balance
        await User.findByIdAndUpdate(
          userId,
          { $inc: { mentraBalance: totalAmount } },
          { session }
        );

        // Create token transaction record for processed referral earnings
        const transaction = new TokenTransaction({
          userId: userId,
          type: 'credit',
          amount: totalAmount,
          description: `Referral earnings processed (${pendingEarnings.length} earnings)`,
          reference: `referral_earnings_${Date.now()}`
        });
        await transaction.save({ session });

        result = { success: true, totalProcessed: totalAmount };
      });

      await session.endSession();
      return result;
    } catch (error) {
      console.error('Error processing pending earnings:', error);
      return { success: false, error: 'Failed to process pending earnings' };
    }
  }

  /**
   * Get referral statistics for a user
   */
  static async getReferralStats(userId: string): Promise<{
    success: boolean;
    data?: {
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
    };
    error?: string;
  }> {
    try {
      // Get user's referral code, create one if it doesn't exist
      let referralCode = await ReferralCode.findOne({ userId });
      if (!referralCode) {
        // Generate a referral code for the user
        const generateResult = await ReferralService.generateReferralCode(userId);
        if (!generateResult.success) {
          return { success: false, error: generateResult.error || 'Failed to generate referral code' };
        }
        referralCode = await ReferralCode.findOne({ userId });
        if (!referralCode) {
          return { success: false, error: 'Failed to create referral code' };
        }
      }

      // Get all referrals
      const referrals = await Referral.find({ referrerId: userId })
        .populate('refereeId', 'firstName lastName email')
        .sort({ createdAt: -1 });

      // Calculate total earnings
      const totalEarnings = referrals.reduce((sum, ref) => sum + ref.totalEarnings, 0);

      // Calculate pending earnings
      const pendingEarnings = await ReferralEarning.aggregate([
        { $match: { referrerId: new mongoose.Types.ObjectId(userId), status: 'pending' } },
        { $group: { _id: null, total: { $sum: '$commissionAmount' } } }
      ]);

      const pendingAmount = pendingEarnings.length > 0 ? pendingEarnings[0].total : 0;

      // Get detailed referral data
      const referralData = await Promise.all(
        referrals.map(async (ref) => {
          const referee = ref.refereeId as any;
          
          // Calculate total spent by referee
          const totalSpent = await ReferralEarning.aggregate([
            { $match: { refereeId: ref.refereeId } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ]);

          // Mask names and emails for privacy
          const maskName = (firstName: string, lastName: string): string => {
            return `${firstName.charAt(0)}. ${lastName.charAt(0)}.`;
          };

          const maskEmail = (email: string): string => {
            const [localPart, domain] = email.split('@');
            if (localPart.length <= 2) {
              return `${localPart.charAt(0)}***@${domain}`;
            }
            return `${localPart.charAt(0)}***${localPart.charAt(localPart.length - 1)}@${domain}`;
          };

          return {
            refereeName: maskName(referee.firstName, referee.lastName),
            refereeEmail: maskEmail(referee.email),
            joinedAt: ref.createdAt,
            totalSpent: totalSpent.length > 0 ? totalSpent[0].total : 0,
            earnings: ref.totalEarnings
          };
        })
      );

      return {
        success: true,
        data: {
          referralCode: referralCode.code,
          referralLink: `${process.env.CLIENT_URL || 'http://localhost:3000'}/register?ref=${referralCode.code}`,
          totalReferrals: referrals.length,
          totalEarnings,
          pendingEarnings: pendingAmount,
          referrals: referralData
        }
      };
    } catch (error) {
      console.error('Error getting referral stats:', error);
      return { success: false, error: 'Failed to get referral statistics' };
    }
  }
}
