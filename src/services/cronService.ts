import cron from 'node-cron';
import { PayoutService } from './payoutService';
import { notificationService } from './notificationService';

export class CronService {
  private static isRunning = false;

  // Start all cron jobs
  static startCronJobs(): void {
    console.log('Starting cron jobs...');

    // Check for pending payouts every hour
    cron.schedule('0 * * * *', async () => {
      if (this.isRunning) {
        console.log('Payout check already running, skipping...');
        return;
      }

      try {
        this.isRunning = true;
        console.log('Running hourly payout check...');
        await PayoutService.checkPendingPayouts();
        console.log('Payout check completed');
      } catch (error) {
        console.error('Error in payout cron job:', error);
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
        console.log('Running business hours payout check...');
        await PayoutService.checkPendingPayouts();
      } catch (error) {
        console.error('Error in business hours payout cron job:', error);
      } finally {
        this.isRunning = false;
      }
    }, {
      timezone: 'UTC'
    });

    // Process pending notifications every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      try {
        console.log('Processing pending notifications...');
        await notificationService.processPendingNotifications();
        console.log('Notification processing completed');
      } catch (error) {
        console.error('Error in notification cron job:', error);
      }
    }, {
      timezone: 'UTC'
    });

    console.log('Cron jobs started successfully');
  }

  // Stop all cron jobs
  static stopCronJobs(): void {
    cron.getTasks().forEach(task => {
      task.destroy();
    });
    console.log('All cron jobs stopped');
  }

  // Manual payout check (for testing)
  static async runManualPayoutCheck(): Promise<void> {
    try {
      console.log('Running manual payout check...');
      await PayoutService.checkPendingPayouts();
      console.log('Manual payout check completed');
    } catch (error) {
      console.error('Error in manual payout check:', error);
      throw error;
    }
  }
}
