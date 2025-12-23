import cron from 'node-cron';
import { PayoutService } from './payoutService';
import { notificationService } from './notificationService';
import { AutoCancelService } from './autoCancelService';
import { RefundService } from './refundService';
import { SharedFile } from '../models/SharedFile';
import { deleteResource } from '../config/cloudinary';

// Cleanup expired shared files
const cleanupExpiredFiles = async () => {
    try {
        console.log('Running expired files cleanup...');
        
        // Find expired files
        const expiredFiles = await SharedFile.find({ 
            expiresAt: { $lt: new Date() } 
        });

        if (expiredFiles.length === 0) {
            console.log('No expired files found');
            return;
        }

        console.log(`Found ${expiredFiles.length} expired files to delete`);

        let deletedCount = 0;
        let errorCount = 0;

        // Delete each file
        for (const file of expiredFiles) {
            try {
                // Delete from Cloudinary
                // Use resourceType from DB, default to 'auto' or 'image' if missing
                const resourceType = file.resourceType || 'image';
                
                // Note: If resourceType is 'auto', we might need to try both or rely on what was saved
                // Usually Cloudinary return explicit type (image/video/raw)
                
                await deleteResource(file.publicId, resourceType);
                
                // Delete from DB
                await SharedFile.findByIdAndDelete(file._id);
                deletedCount++;
            } catch (err) {
                console.error(`Failed to delete file ${file._id}:`, err);
                errorCount++;
                
                // If it's a "not found" error from Cloudinary, we should still delete from DB
                // But for safety initially we might skip
                // For now, if we can't find it in Cloudinary, we still remove from DB to keep DB clean?
                // Or maybe just log it. Let's delete from DB if error is "not found"
                if ((err as any)?.http_code === 404 || (err as any)?.message?.includes('not found')) {
                    await SharedFile.findByIdAndDelete(file._id);
                    deletedCount++;
                }
            }
        }

        console.log(`Cleanup complete. Deleted: ${deletedCount}, Errors: ${errorCount}`);

    } catch (error) {
        console.error('Error in file cleanup job:', error);
    }
};

// Placeholder for refundExpiredMessages if it's not defined elsewhere
// Assuming it's a function that exists or will be added.
const refundExpiredMessages = async () => {
  console.log('Running refund for expired messages...');
  // Add actual logic here if needed, or ensure it's imported/defined elsewhere
};

export class CronService {
  private static isRunning = false;

  // Start all cron jobs
  static startCronJobs(): void {
    console.log('Starting cron jobs...');

    // Check for pending payouts every hour
    cron.schedule('0 * * * *', async () => {
      if (this.isRunning) {
        
        return;
      }

      try {
        this.isRunning = true;
        
        await PayoutService.checkPendingPayouts();
        // Payout check completed
      } catch (error) {
        // Error in payout cron job
      } finally {
        this.isRunning = false;
      }
    }, {
      timezone: 'UTC'
    });

    // More frequent checks during business hours (every 30 minutes)
    cron.schedule('*/30 9-17 * * 1-5', async () => {
      if (this.isRunning) {
        return;
      }

      try {
        this.isRunning = true;
        // Running business hours payout check...
        await PayoutService.checkPendingPayouts();
      } catch (error) {
        // Error in business hours payout cron job
      } finally {
        this.isRunning = false;
      }
    }, {
      timezone: 'UTC'
    });

    // Process pending notifications every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      try {
        // Processing pending notifications...
        await notificationService.processPendingNotifications();
        // Notification processing completed
      } catch (error) {
        // Error in notification cron job
      }
    }, {
      timezone: 'UTC'
    });

    // Auto-cancel pending bookings every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      try {
        // Running auto-cancel check for pending bookings...
        await AutoCancelService.cancelPendingBookings();
      } catch (error) {
        // Error in auto-cancel cron job
      }
    }, {
      timezone: 'UTC'
    });

    // Check for expired cold messages every hour to refund tokens
    cron.schedule('0 * * * *', async () => {
      try {
        await RefundService.processExpiredColdMessages();
      } catch (error) {
        console.error('Error in cold message refund cron job:', error);
      }
    }, {
      timezone: 'UTC'
    });

    // Cleanup expired shared files every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
      try {
        await cleanupExpiredFiles();
      } catch (error) {
        console.error('Error in file cleanup cron job:', error);
      }
    }, {
      timezone: 'UTC'
    });

    // Cron jobs started successfully
  }

  // Stop all cron jobs
  static stopCronJobs(): void {
    cron.getTasks().forEach(task => {
      task.destroy();
    });
    // All cron jobs stopped
  }

  // Manual payout check (for testing)
  static async runManualPayoutCheck(): Promise<void> {
    try {
        // Running manual payout check...
      await PayoutService.checkPendingPayouts();
      // Manual payout check completed
    } catch (error) {
      // Error in manual payout check
      throw error;
    }
  }
}
