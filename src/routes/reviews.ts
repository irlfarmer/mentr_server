import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  createReview,
  getServiceReviews,
  getMentorReviews,
  getUserReviews,
  updateReview,
  deleteReview
} from '../controllers/reviewController';

const router = express.Router();

// Create a review (authenticated)
router.post('/', authenticate, createReview);

// Get reviews for a service (public)
router.get('/service/:serviceId', getServiceReviews);

// Get reviews for a mentor (public)
router.get('/mentor/:mentorId', getMentorReviews);

// Get user's reviews (authenticated)
router.get('/user', authenticate, getUserReviews);

// Update a review (authenticated)
router.put('/:id', authenticate, updateReview);

// Delete a review (authenticated)
router.delete('/:id', authenticate, deleteReview);

export default router;
