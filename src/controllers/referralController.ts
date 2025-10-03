import { Request, Response } from 'express';
import { ReferralService } from '../services/referralService';
import { AuthRequest } from '../middleware/auth';

export class ReferralController {
  /**
   * Generate or get user's referral code
   */
  static async getReferralCode(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;

      const result = await ReferralService.generateReferralCode(userId);
      
      if (result.success) {
        res.json({
          success: true,
          data: {
            referralCode: result.code,
            referralLink: `${process.env.CLIENT_URL || 'http://localhost:3000'}/register?ref=${result.code}`
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error getting referral code:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Process referral code during signup
   */
  static async processReferralCode(req: Request, res: Response): Promise<void> {
    try {
      const { referralCode, userId } = req.body;

      if (!referralCode || !userId) {
        res.status(400).json({
          success: false,
          error: 'Referral code and user ID are required'
        });
        return;
      }

      const result = await ReferralService.processReferralCode(referralCode, userId);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Referral code processed successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error processing referral code:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get referral statistics
   */
  static async getReferralStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;

      const result = await ReferralService.getReferralStats(userId);
      
      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error getting referral stats:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Process pending earnings
   */
  static async processPendingEarnings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;

      const result = await ReferralService.processPendingEarnings(userId);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Pending earnings processed successfully',
          data: {
            totalProcessed: result.totalProcessed
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error processing pending earnings:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}
