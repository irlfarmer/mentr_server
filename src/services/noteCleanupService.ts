import Note from '../models/Note';
import cron from 'node-cron';

export class NoteCleanupService {
  // Clean up notes older than 30 days
  static async cleanupOldNotes(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await Note.deleteMany({
        createdAt: { $lt: thirtyDaysAgo }
      });

      console.log(`Note cleanup: Deleted ${result.deletedCount} notes older than 30 days`);
    } catch (error) {
      console.error('Note cleanup error:', error);
    }
  }

  // Mark notes as immutable when session time has passed
  static async markNotesAsImmutable(): Promise<void> {
    try {
      const now = new Date();
      
      // Find notes that should be immutable but aren't yet
      const notes = await Note.find({
        isImmutable: false
      }).populate('bookingId', 'scheduledAt duration');

      let markedCount = 0;

      for (const note of notes) {
        const booking = note.bookingId as any;
        if (booking && booking.scheduledAt && booking.duration) {
          const sessionEndTime = new Date(booking.scheduledAt.getTime() + (booking.duration * 60 * 1000));
          
          if (now > sessionEndTime) {
            note.isImmutable = true;
            await note.save();
            markedCount++;
          }
        }
      }

      if (markedCount > 0) {
        console.log(`Note immutability: Marked ${markedCount} notes as immutable`);
      }
    } catch (error) {
      console.error('Note immutability check error:', error);
    }
  }

  // Initialize cleanup jobs
  static initializeCleanupJobs(): void {
    // Run cleanup every day at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('Running daily note cleanup...');
      await NoteCleanupService.cleanupOldNotes();
      await NoteCleanupService.markNotesAsImmutable();
    }, {
      timezone: 'UTC'
    });

    // Run immutability check every hour
    cron.schedule('0 * * * *', async () => {
      await NoteCleanupService.markNotesAsImmutable();
    }, {
      timezone: 'UTC'
    });

    console.log('Note cleanup jobs initialized');
  }
}
