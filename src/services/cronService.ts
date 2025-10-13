import cron from 'node-cron';
import { PayoutService } from './payoutService';
import { notificationService } from './notificationService';
import { AutoCancelService } from './autoCancelService';

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
