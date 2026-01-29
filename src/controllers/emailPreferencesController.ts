import { Request, Response } from 'express';
import { EmailPreferencesService } from '../services/emailPreferencesService';
import { User } from '../models/User';

export class EmailPreferencesController {
  // Get current user's email preferences
  static async getPreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      let preferences = await EmailPreferencesService.getEmailPreferences(userId);
      
      // Create default preferences if none exist
      if (!preferences) {
        const user = await User.findById(userId).select('email');
        if (!user) {
          res.status(404).json({
            success: false,
            error: 'User not found'
          });
          return;
        }

        preferences = await EmailPreferencesService.createEmailPreferences({
          userId,
          email: user.email
        });
      }

      res.json({
        success: true,
        data: preferences
      });
    } catch (error) {
      console.error('Error getting email preferences:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get email preferences'
      });
    }
  }

  // Update current user's email preferences
  static async updatePreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      const { categories, frequency } = req.body;

      // Validate frequency
      if (frequency && !['immediate', 'daily', 'weekly', 'never'].includes(frequency)) {
        res.status(400).json({
          success: false,
          error: 'Invalid frequency value'
        });
        return;
      }

      const updates: any = {};
      if (categories) {
        updates.categories = categories;
      }
      if (frequency) {
        updates.frequency = frequency;
      }

      const preferences = await EmailPreferencesService.updateEmailPreferences(userId, updates);
      if (!preferences) {
        res.status(404).json({
          success: false,
          error: 'Email preferences not found'
        });
        return;
      }

      res.json({
        success: true,
        data: preferences,
        message: 'Email preferences updated successfully'
      });
    } catch (error) {
      console.error('Error updating email preferences:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update email preferences'
      });
    }
  }

  // Unsubscribe from all emails
  static async unsubscribeAll(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      const success = await EmailPreferencesService.unsubscribeAll(token as string);
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Invalid unsubscribe token'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Successfully unsubscribed from all emails'
      });
    } catch (error) {
      console.error('Error unsubscribing from all emails:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to unsubscribe from all emails'
      });
    }
  }

  // Unsubscribe from specific category
  static async unsubscribeCategory(req: Request, res: Response): Promise<void> {
    try {
      const { token, category } = req.params;

      // Validate category
      const validCategories = ['booking', 'reschedule', 'chat', 'payout', 'dispute', 'system', 'verification', 'marketing'];
      if (!validCategories.includes(category as string)) {
        res.status(400).json({
          success: false,
          error: 'Invalid category'
        });
        return;
      }

      const success = await EmailPreferencesService.unsubscribeCategory(token as string, category as any);
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Invalid unsubscribe token'
        });
        return;
      }

      res.json({
        success: true,
        message: `Successfully unsubscribed from ${category} emails`
      });
    } catch (error) {
      console.error('Error unsubscribing from category:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to unsubscribe from category'
      });
    }
  }

  // Resubscribe to emails
  static async resubscribe(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      const success = await EmailPreferencesService.resubscribe(token as string);
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Invalid resubscribe token'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Successfully resubscribed to emails'
      });
    } catch (error) {
      console.error('Error resubscribing:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to resubscribe'
      });
    }
  }

  // Get unsubscribe page data
  static async getUnsubscribePage(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      const preferences = await EmailPreferencesService.getEmailPreferencesByToken(token as string);
      if (!preferences) {
        res.status(404).json({
          success: false,
          error: 'Invalid unsubscribe token'
        });
        return;
      }

      const user = await User.findById(preferences.userId).select('firstName lastName email');
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
          user: {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email
          },
          preferences: {
            isUnsubscribed: preferences.isUnsubscribed,
            categories: preferences.categories,
            frequency: preferences.frequency
          }
        }
      });
    } catch (error) {
      console.error('Error getting unsubscribe page data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get unsubscribe page data'
      });
    }
  }

  // Get email statistics (admin only)
  static async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const adminId = (req as any).user?.id;

      // Check if user is admin
      const admin = await User.findById(adminId);
      if (!admin || admin.userType !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
        return;
      }

      const statistics = await EmailPreferencesService.getEmailStatistics();

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('Error getting email statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get email statistics'
      });
    }
  }

  // Get email preferences for a specific user (admin only)
  static async getPreferencesForUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const adminId = (req as any).user?.id;

      // Check if user is admin
      const admin = await User.findById(adminId);
      if (!admin || admin.userType !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
        return;
      }

      const preferences = await EmailPreferencesService.getEmailPreferences(userId as string);
      if (!preferences) {
        res.status(404).json({
          success: false,
          error: 'Email preferences not found for this user'
        });
        return;
      }

      res.json({
        success: true,
        data: preferences
      });
    } catch (error) {
      console.error('Error getting user email preferences:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user email preferences'
      });
    }
  }

  // Update email preferences for a specific user (admin only)
  static async updatePreferencesForUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const adminId = (req as any).user?.id;

      // Check if user is admin
      const admin = await User.findById(adminId);
      if (!admin || admin.userType !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
        return;
      }

      // Check if target user exists
      const targetUser = await User.findById(userId);
      if (!targetUser) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      const updateData = req.body;
      const preferences = await EmailPreferencesService.updateEmailPreferences(userId as string, updateData);

      res.json({
        success: true,
        data: preferences,
        message: 'User email preferences updated successfully'
      });
    } catch (error) {
      console.error('Error updating user email preferences:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update user email preferences'
      });
    }
  }
}
