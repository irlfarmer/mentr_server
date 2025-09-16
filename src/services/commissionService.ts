import { IUserDocument } from '../models/User';

export interface CommissionTier {
  tier: string;
  minSessions: number;
  minEarnings: number;
  commissionRate: number;
  description: string;
}

export const COMMISSION_TIERS: CommissionTier[] = [
  {
    tier: 'tier1',
    minSessions: 0,
    minEarnings: 0,
    commissionRate: 0.25, // 25%
    description: 'New mentors (0-2 sessions OR <$100)'
  },
  {
    tier: 'tier2',
    minSessions: 3,
    minEarnings: 100,
    commissionRate: 0.22, // 22%
    description: 'Getting started (3-5 sessions OR $100-$300)'
  },
  {
    tier: 'tier3',
    minSessions: 6,
    minEarnings: 300,
    commissionRate: 0.20, // 20%
    description: 'Building momentum (6-10 sessions OR $300-$750)'
  },
  {
    tier: 'tier4',
    minSessions: 11,
    minEarnings: 750,
    commissionRate: 0.17, // 17%
    description: 'Established (11-20 sessions OR $750-$1,500)'
  },
  {
    tier: 'tier5',
    minSessions: 21,
    minEarnings: 1500,
    commissionRate: 0.15, // 15%
    description: 'Experienced (21-35 sessions OR $1,500-$3,000)'
  },
  {
    tier: 'tier6',
    minSessions: 36,
    minEarnings: 3000,
    commissionRate: 0.12, // 12%
    description: 'Professional (36-50 sessions OR $3,000-$5,000)'
  },
  {
    tier: 'tier7',
    minSessions: 51,
    minEarnings: 5000,
    commissionRate: 0.10, // 10%
    description: 'Expert (51+ sessions OR $5,000+)'
  },
  {
    tier: 'tier8',
    minSessions: 100,
    minEarnings: 10000,
    commissionRate: 0.08, // 8%
    description: 'Master (100+ sessions AND $10,000+)'
  }
];

export class CommissionService {
  /**
   * Calculate the appropriate commission tier for a mentor
   * Uses hybrid approach: mentor qualifies if they meet EITHER session OR earnings criteria
   */
  static calculateTier(mentor: IUserDocument): string {
    const { totalCompletedSessions = 0, totalEarnings = 0 } = mentor.mentorEarnings || {};
    
    // Find the highest tier the mentor qualifies for
    for (let i = COMMISSION_TIERS.length - 1; i >= 0; i--) {
      const tier = COMMISSION_TIERS[i];
      
      // Check if mentor meets either criteria for this tier
      const meetsSessionCriteria = totalCompletedSessions >= tier.minSessions;
      const meetsEarningsCriteria = totalEarnings >= tier.minEarnings;
      
      // For tier8, require BOTH criteria
      if (tier.tier === 'tier8') {
        if (meetsSessionCriteria && meetsEarningsCriteria) {
          return tier.tier;
        }
      } else {
        // For all other tiers, EITHER criteria qualifies
        if (meetsSessionCriteria || meetsEarningsCriteria) {
          return tier.tier;
        }
      }
    }
    
    // Default to tier1 if no criteria met
    return 'tier1';
  }

  /**
   * Get commission rate for a specific tier
   */
  static getCommissionRate(tier: string): number {
    const tierConfig = COMMISSION_TIERS.find(t => t.tier === tier);
    return tierConfig ? tierConfig.commissionRate : 0.25; // Default to 25% if tier not found
  }

  /**
   * Calculate commission amount for a given earning
   */
  static calculateCommission(amount: number, tier: string): number {
    const rate = this.getCommissionRate(tier);
    return Math.round(amount * rate * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate mentor payout after commission
   */
  static calculateMentorPayout(amount: number, tier: string): number {
    const commission = this.calculateCommission(amount, tier);
    return Math.round((amount - commission) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get tier information for display
   */
  static getTierInfo(tier: string): CommissionTier | null {
    return COMMISSION_TIERS.find(t => t.tier === tier) || null;
  }

  /**
   * Get next tier information for motivation
   */
  static getNextTierInfo(currentTier: string): CommissionTier | null {
    const currentIndex = COMMISSION_TIERS.findIndex(t => t.tier === currentTier);
    if (currentIndex === -1 || currentIndex === COMMISSION_TIERS.length - 1) {
      return null; // Already at highest tier or invalid tier
    }
    return COMMISSION_TIERS[currentIndex + 1];
  }

  /**
   * Check if mentor should be upgraded to a new tier
   */
  static shouldUpgradeTier(mentor: IUserDocument): boolean {
    const currentTier = mentor.mentorEarnings?.commissionTier || 'tier1';
    const calculatedTier = this.calculateTier(mentor);
    return calculatedTier !== currentTier;
  }

  /**
   * Get progress towards next tier
   */
  static getTierProgress(mentor: IUserDocument): {
    currentTier: CommissionTier;
    nextTier: CommissionTier | null;
    progress: {
      sessions: { current: number; required: number; percentage: number };
      earnings: { current: number; required: number; percentage: number };
    };
  } | null {
    const currentTier = mentor.mentorEarnings?.commissionTier || 'tier1';
    const nextTier = this.getNextTierInfo(currentTier);
    
    if (!nextTier) {
      return null; // Already at highest tier
    }

    const { totalCompletedSessions = 0, totalEarnings = 0 } = mentor.mentorEarnings || {};
    const currentTierInfo = this.getTierInfo(currentTier);
    
    if (!currentTierInfo) {
      return null;
    }

    const sessionProgress = {
      current: totalCompletedSessions,
      required: nextTier.minSessions,
      percentage: Math.min(100, (totalCompletedSessions / nextTier.minSessions) * 100)
    };

    const earningsProgress = {
      current: totalEarnings,
      required: nextTier.minEarnings,
      percentage: Math.min(100, (totalEarnings / nextTier.minEarnings) * 100)
    };

    return {
      currentTier: currentTierInfo,
      nextTier,
      progress: {
        sessions: sessionProgress,
        earnings: earningsProgress
      }
    };
  }
}

export default CommissionService;
