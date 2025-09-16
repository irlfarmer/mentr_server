import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import { MentorEarningsService } from '../services/mentorEarningsService';
import { CommissionService, COMMISSION_TIERS } from '../services/commissionService';

// Get mentor's earnings summary
export const getMentorEarnings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    const earningsSummary = await MentorEarningsService.getEarningsSummary(userId);
    
    if (!earningsSummary) {
      res.status(404).json({
        success: false,
        error: 'Earnings data not found'
      });
      return;
    }

    res.json({
      success: true,
      data: earningsSummary
    });
  } catch (error) {
    console.error('Get mentor earnings error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get mentor's monthly earnings
export const getMonthlyEarnings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    const { year, months } = req.query;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    const monthlyEarnings = await MentorEarningsService.getMonthlyEarnings(
      userId, 
      year ? parseInt(year as string) : undefined,
      months ? parseInt(months as string) : 12
    );
    
    res.json({
      success: true,
      data: monthlyEarnings
    });
  } catch (error) {
    console.error('Get monthly earnings error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get all commission tiers (for display)
export const getCommissionTiers = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({
      success: true,
      data: {
        tiers: COMMISSION_TIERS
      }
    });
  } catch (error) {
    console.error('Get commission tiers error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get mentor's tier progress
export const getTierProgress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    const { User } = await import('../models/User');
    const mentor = await User.findById(userId);
    
    if (!mentor) {
      res.status(404).json({
        success: false,
        error: 'Mentor not found'
      });
      return;
    }

    const tierProgress = CommissionService.getTierProgress(mentor);
    
    res.json({
      success: true,
      data: tierProgress
    });
  } catch (error) {
    console.error('Get tier progress error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Admin: Get all mentor earnings
export const getAllMentorEarnings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    // Check if user is admin
    const { User } = await import('../models/User');
    const user = await User.findById(userId).select('userType');
    
    if (!user || user.userType !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
      return;
    }

    const allEarnings = await MentorEarningsService.getAllMentorEarnings();
    const totalCommission = await MentorEarningsService.getTotalPlatformCommission();

    res.json({
      success: true,
      data: {
        mentorEarnings: allEarnings,
        platformStats: totalCommission
      }
    });
  } catch (error) {
    console.error('Get all mentor earnings error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Admin: Update mentor tier manually
export const updateMentorTier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id;
    const { mentorId, newTier } = req.body;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
      return;
    }

    // Check if user is admin
    const { User } = await import('../models/User');
    const user = await User.findById(userId).select('userType');
    
    if (!user || user.userType !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
      return;
    }

    if (!mentorId || !newTier) {
      res.status(400).json({
        success: false,
        error: 'Mentor ID and new tier are required'
      });
      return;
    }

    const validTiers = ['tier1', 'tier2', 'tier3', 'tier4', 'tier5', 'tier6', 'tier7', 'tier8'];
    if (!validTiers.includes(newTier)) {
      res.status(400).json({
        success: false,
        error: 'Invalid tier'
      });
      return;
    }

    const success = await MentorEarningsService.updateMentorTier(mentorId, newTier);
    
    if (!success) {
      res.status(404).json({
        success: false,
        error: 'Mentor not found or update failed'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Mentor tier updated successfully'
    });
  } catch (error) {
    console.error('Update mentor tier error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
