import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  getNote,
  updateNote,
  markNotesAsImmutable,
  getAllNotesForCleanup,
  deleteOldNotes
} from '../controllers/noteController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get note for a specific booking
router.get('/booking/:bookingId', getNote);

// Update note content
router.patch('/booking/:bookingId', updateNote);

// Mark notes as immutable (called by cleanup job)
router.patch('/booking/:bookingId/immutable', markNotesAsImmutable);

// Admin routes for cleanup
router.get('/cleanup', requireAdmin, getAllNotesForCleanup);
router.delete('/cleanup', requireAdmin, deleteOldNotes);

export default router;
