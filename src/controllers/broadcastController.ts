import { Request, Response } from 'express';
import { User } from '../models/User';
import { notificationService } from '../services/notificationService';
import { AuthRequest } from '../middleware/auth';

// Send a broadcast notification to all mentors or all students
export const sendBroadcast = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { target, title, message, category, priority } = req.body;

    if (!title || !message) {
      res.status(400).json({ success: false, error: 'Title and message are required' });
      return;
    }

    let query: any = { isActive: true, isBanned: false };
    if (target === 'mentors') {
      query.userType = { $in: ['mentor', 'both'] };
    } else if (target === 'students') {
      query.userType = { $in: ['student', 'both'] };
    }

    const users = await User.find(query).select('_id');

    // Send notifications in batches to avoid overwhelming the system
    const batchSize = 50;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      await Promise.all(batch.map(async (user: any) => {
        // 1. Send via multi-type (handles email/push based on prefs)
        await notificationService.createMultiTypeNotification(
          user._id.toString(),
          category || 'system',
          title,
          message,
          {},
          priority || 'medium'
        );

        // 2. Force create in-app notification to ensure it appears in the web UI/center
        // This acts as a backup in case prefs blocked it or logic failed
        await notificationService.createNotification({
          userId: user._id.toString(),
          type: 'in_app',
          category: category || 'system',
          title,
          message,
          priority: priority || 'medium',
          sendImmediately: true
        });
      }));
    }

    res.json({
      success: true,
      message: `Broadcast sent to ${users.length} users`
    });
  } catch (error) {
    console.error('Broadcast send error:', error);
    res.status(500).json({ success: false, error: 'Failed to send broadcast' });
  }
};
