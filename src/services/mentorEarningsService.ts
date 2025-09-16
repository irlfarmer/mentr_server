import { User, IUserDocument } from '../models/User';
import { CommissionService } from './commissionService';

export interface EarningsUpdate {
  amount: number;
  type: 'session' | 'message';
  description: string;
  bookingId?: string;
  messageId?: string;
}

export class MentorEarningsService {
  /**
   * Add earnings for a mentor and update their tier if needed
   */
  static async addEarnings(
    mentorId: string, 
    earningsUpdate: EarningsUpdate
  ): Promise<{ success: boolean; newTier?: string; commissionAmount?: number }> {
    try {
      const mentor = await User.findById(mentorId);
      if (!mentor) {
        throw new Error('Mentor not found');
      }

      // Initialize mentorEarnings if it doesn't exist
      if (!mentor.mentorEarnings) {
        mentor.mentorEarnings = {
          totalEarnings: 0,
          sessionEarnings: 0,
          messageEarnings: 0,
          totalCompletedSessions: 0,
          totalColdMessages: 0,
          commissionTier: 'tier1',
          lastTierUpdate: new Date(),
          monthlyEarnings: []
        };
      }

      // Calculate current tier and commission
      const currentTier = CommissionService.calculateTier(mentor);
      const commissionAmount = CommissionService.calculateCommission(earningsUpdate.amount, currentTier);
      const mentorPayout = CommissionService.calculateMentorPayout(earningsUpdate.amount, currentTier);

      // Update earnings based on type
      if (earningsUpdate.type === 'session') {
        mentor.mentorEarnings.sessionEarnings += mentorPayout;
        mentor.mentorEarnings.totalCompletedSessions += 1;
      } else if (earningsUpdate.type === 'message') {
        mentor.mentorEarnings.messageEarnings += mentorPayout;
        mentor.mentorEarnings.totalColdMessages += 1;
      }

      // Update total earnings
      mentor.mentorEarnings.totalEarnings += mentorPayout;

      // Check if tier should be updated
      const newTier = CommissionService.calculateTier(mentor);
      const tierChanged = newTier !== mentor.mentorEarnings.commissionTier;
      
      if (tierChanged) {
        mentor.mentorEarnings.commissionTier = newTier as 'tier1' | 'tier2' | 'tier3' | 'tier4' | 'tier5' | 'tier6' | 'tier7' | 'tier8';
        mentor.mentorEarnings.lastTierUpdate = new Date();
      }

      // Update monthly earnings
      await this.updateMonthlyEarnings(mentor, earningsUpdate, mentorPayout);

      await mentor.save();

      return {
        success: true,
        newTier: tierChanged ? newTier : undefined,
        commissionAmount
      };
    } catch (error) {
      console.error('Error adding mentor earnings:', error);
      return { success: false };
    }
  }

  /**
   * Update monthly earnings for a mentor
   */
  private static async updateMonthlyEarnings(mentor: any, earningsUpdate: EarningsUpdate, mentorPayout: number): Promise<void> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11, we want 1-12


    // Ensure monthlyEarnings array exists
    if (!mentor.mentorEarnings.monthlyEarnings) {
      mentor.mentorEarnings.monthlyEarnings = [];
    }

    // Find existing monthly earnings entry for current month/year
    let monthlyEntry = mentor.mentorEarnings.monthlyEarnings.find(
      (entry: any) => entry.year === currentYear && entry.month === currentMonth
    );

    if (!monthlyEntry) {
      // Create new monthly entry
      monthlyEntry = {
        year: currentYear,
        month: currentMonth,
        sessionEarnings: 0,
        messageEarnings: 0,
        totalEarnings: 0,
        sessionsCompleted: 0,
        coldMessages: 0
      };
      mentor.mentorEarnings.monthlyEarnings.push(monthlyEntry);
    }

    // Update monthly earnings based on type
    if (earningsUpdate.type === 'session') {
      monthlyEntry.sessionEarnings += mentorPayout;
      monthlyEntry.sessionsCompleted += 1;
    } else if (earningsUpdate.type === 'message') {
      monthlyEntry.messageEarnings += mentorPayout;
      monthlyEntry.coldMessages += 1;
    }

    monthlyEntry.totalEarnings = monthlyEntry.sessionEarnings + monthlyEntry.messageEarnings;
  }

  /**
   * Get mentor earnings summary
   */
  static async getEarningsSummary(mentorId: string): Promise<{
    earnings: any;
    tierInfo: any;
    nextTierProgress: any;
  } | null> {
    try {
      const mentor = await User.findById(mentorId).select('mentorEarnings');
      if (!mentor || !mentor.mentorEarnings) {
        return null;
      }

      const currentTier = mentor.mentorEarnings.commissionTier;
      const tierInfo = CommissionService.getTierInfo(currentTier);
      const nextTierProgress = CommissionService.getTierProgress(mentor);

      return {
        earnings: mentor.mentorEarnings,
        tierInfo,
        nextTierProgress
      };
    } catch (error) {
      console.error('Error getting mentor earnings summary:', error);
      return null;
    }
  }

  /**
   * Get monthly earnings for a mentor
   */
  static async getMonthlyEarnings(mentorId: string, year?: number, months: number = 12): Promise<any[]> {
    try {
      const mentor = await User.findById(mentorId).select('mentorEarnings');
      if (!mentor || !mentor.mentorEarnings) {
        console.log(`No mentor or earnings found for ${mentorId}`);
        return [];
      }

      const currentYear = year || new Date().getFullYear();
      const monthlyEarnings = mentor.mentorEarnings.monthlyEarnings || [];
      
      
      // Filter by year if specified
      let filteredEarnings = monthlyEarnings.filter((entry: any) => entry.year === currentYear);
      
      // Sort by month (most recent first)
      filteredEarnings.sort((a: any, b: any) => b.month - a.month);
      
      // Limit to requested number of months
      return filteredEarnings.slice(0, months);
    } catch (error) {
      console.error('Error getting monthly earnings:', error);
      return [];
    }
  }

  /**
   * Update mentor tier (useful for manual adjustments)
   */
  static async updateMentorTier(mentorId: string, newTier: string): Promise<boolean> {
    try {
      const mentor = await User.findById(mentorId);
      if (!mentor) {
        return false;
      }

      if (!mentor.mentorEarnings) {
        mentor.mentorEarnings = {
          totalEarnings: 0,
          sessionEarnings: 0,
          messageEarnings: 0,
          totalCompletedSessions: 0,
          totalColdMessages: 0,
          commissionTier: newTier as any,
          lastTierUpdate: new Date(),
          monthlyEarnings: []
        };
      } else {
        mentor.mentorEarnings.commissionTier = newTier as any;
        mentor.mentorEarnings.lastTierUpdate = new Date();
      }

      await mentor.save();
      return true;
    } catch (error) {
      console.error('Error updating mentor tier:', error);
      return false;
    }
  }

  /**
   * Get all mentors with their earnings (for admin dashboard)
   */
  static async getAllMentorEarnings(): Promise<Array<{
    mentorId: string;
    mentorName: string;
    earnings: any;
    tierInfo: any;
  }>> {
    try {
      const mentors = await User.find({ 
        userType: { $in: ['mentor', 'both'] },
        mentorEarnings: { $exists: true }
      }).select('firstName lastName mentorEarnings');

      return mentors.map(mentor => ({
        mentorId: (mentor._id as any).toString(),
        mentorName: `${mentor.firstName} ${mentor.lastName}`,
        earnings: mentor.mentorEarnings,
        tierInfo: CommissionService.getTierInfo(mentor.mentorEarnings?.commissionTier || 'tier1')
      }));
    } catch (error) {
      console.error('Error getting all mentor earnings:', error);
      return [];
    }
  }

  /**
   * Calculate total platform commission from all mentor earnings
   */
  static async getTotalPlatformCommission(): Promise<{
    totalCommission: number;
    totalMentorPayouts: number;
    totalGrossEarnings: number;
  }> {
    try {
      const mentors = await User.find({ 
        userType: { $in: ['mentor', 'both'] },
        mentorEarnings: { $exists: true }
      }).select('mentorEarnings');

      let totalCommission = 0;
      let totalMentorPayouts = 0;

      for (const mentor of mentors) {
        if (mentor.mentorEarnings) {
          const tier = mentor.mentorEarnings.commissionTier;
          const commissionRate = CommissionService.getCommissionRate(tier);
          
          // Calculate what the gross earnings would have been
          const grossEarnings = mentor.mentorEarnings.totalEarnings / (1 - commissionRate);
          const commission = grossEarnings - mentor.mentorEarnings.totalEarnings;
          
          totalCommission += commission;
          totalMentorPayouts += mentor.mentorEarnings.totalEarnings;
        }
      }

      return {
        totalCommission,
        totalMentorPayouts,
        totalGrossEarnings: totalCommission + totalMentorPayouts
      };
    } catch (error) {
      console.error('Error calculating total platform commission:', error);
      return {
        totalCommission: 0,
        totalMentorPayouts: 0,
        totalGrossEarnings: 0
      };
    }
  }

  /**
   * Get platform statistics for admin dashboard
   */
  static async getPlatformStats(): Promise<{
    totalCommission: number;
    totalMentorPayouts: number;
    totalRevenue: number;
    totalSessions: number;
    totalColdMessages: number;
  }> {
    try {
      const mentors = await User.find({ 
        userType: { $in: ['mentor', 'both'] },
        mentorEarnings: { $exists: true }
      }).select('mentorEarnings');

      let totalCommission = 0;
      let totalMentorPayouts = 0;
      let totalRevenue = 0;
      let totalSessions = 0;
      let totalColdMessages = 0;

      mentors.forEach(mentor => {
        if (mentor.mentorEarnings) {
          totalMentorPayouts += mentor.mentorEarnings.totalEarnings || 0;
          totalSessions += mentor.mentorEarnings.totalCompletedSessions || 0;
          totalColdMessages += mentor.mentorEarnings.totalColdMessages || 0;
        }
      });

      // Calculate total revenue (mentor payouts + platform commission)
      // For now, we'll estimate commission as 20% of total mentor payouts
      totalCommission = totalMentorPayouts * 0.2; // This is a rough estimate
      totalRevenue = totalMentorPayouts + totalCommission;

      return {
        totalCommission,
        totalMentorPayouts,
        totalRevenue,
        totalSessions,
        totalColdMessages
      };
    } catch (error) {
      console.error('Error getting platform stats:', error);
      return {
        totalCommission: 0,
        totalMentorPayouts: 0,
        totalRevenue: 0,
        totalSessions: 0,
        totalColdMessages: 0
      };
    }
  }
}

export default MentorEarningsService;
