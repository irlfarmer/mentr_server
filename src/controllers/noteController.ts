import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Note from '../models/Note';
import { Booking } from '../models/Booking';

// Get note for a specific booking
export const getNote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const userId = (req.user as any)?._id?.toString();

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    // Verify user has access to this booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
      return;
    }

    // Check if user is either mentor or student in this booking
    const isMentor = booking.mentorId.toString() === userId;
    const isStudent = booking.studentId.toString() === userId;
    
    if (!isMentor && !isStudent) {
      res.status(403).json({
        success: false,
        error: 'Access denied'
      });
      return;
    }

    // Get or create note
    let note = await Note.findOne({ bookingId, userId });
    
    if (!note) {
      // Create empty note if it doesn't exist
      note = new Note({
        bookingId,
        userId,
        content: '',
        isImmutable: false
      });
      await note.save();
    }

    res.status(200).json({
      success: true,
      data: note
    });
  } catch (error: any) {
    console.error('Get note error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get note'
    });
  }
};

// Update note content
export const updateNote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const { content } = req.body;
    const userId = (req.user as any)?._id?.toString();

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    // Verify user has access to this booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
      return;
    }

    // Check if user is either mentor or student in this booking
    const isMentor = booking.mentorId.toString() === userId;
    const isStudent = booking.studentId.toString() === userId;
    
    if (!isMentor && !isStudent) {
      res.status(403).json({
        success: false,
        error: 'Access denied'
      });
      return;
    }

    // Check if note is immutable (session time has passed)
    const sessionEndTime = new Date(booking.scheduledAt.getTime() + (booking.duration * 60 * 1000));
    const now = new Date();
    const isSessionOver = now > sessionEndTime;

    if (isSessionOver) {
      res.status(403).json({
        success: false,
        error: 'Cannot edit notes after session has ended'
      });
      return;
    }

    // Get or create note
    let note = await Note.findOne({ bookingId, userId });
    
    if (!note) {
      note = new Note({
        bookingId,
        userId,
        content: content || '',
        isImmutable: isSessionOver
      });
    } else {
      note.content = content || '';
      note.isImmutable = isSessionOver;
    }

    await note.save();

    res.status(200).json({
      success: true,
      data: note
    });
  } catch (error: any) {
    console.error('Update note error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update note'
    });
  }
};

// Mark notes as immutable (called by cleanup job)
export const markNotesAsImmutable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const userId = (req.user as any)?._id?.toString();

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    // Verify user has access to this booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
      return;
    }

    // Check if user is either mentor or student in this booking
    const isMentor = booking.mentorId.toString() === userId;
    const isStudent = booking.studentId.toString() === userId;
    
    if (!isMentor && !isStudent) {
      res.status(403).json({
        success: false,
        error: 'Access denied'
      });
      return;
    }

    // Update note immutability
    const note = await Note.findOneAndUpdate(
      { bookingId, userId },
      { isImmutable: true },
      { new: true }
    );

    if (!note) {
      res.status(404).json({
        success: false,
        error: 'Note not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: note
    });
  } catch (error: any) {
    console.error('Mark note immutable error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark note as immutable'
    });
  }
};

// Get all notes for cleanup (admin only)
export const getAllNotesForCleanup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const notes = await Note.find({
      createdAt: { $lt: thirtyDaysAgo }
    }).populate('bookingId', 'scheduledAt');

    res.status(200).json({
      success: true,
      data: notes
    });
  } catch (error: any) {
    console.error('Get notes for cleanup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notes for cleanup'
    });
  }
};

// Delete old notes (admin only)
export const deleteOldNotes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await Note.deleteMany({
      createdAt: { $lt: thirtyDaysAgo }
    });

    res.status(200).json({
      success: true,
      data: {
        deletedCount: result.deletedCount,
        message: `Deleted ${result.deletedCount} notes older than 30 days`
      }
    });
  } catch (error: any) {
    console.error('Delete old notes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete old notes'
    });
  }
};
