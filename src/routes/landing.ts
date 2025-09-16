import { Router } from 'express';
import { getFeaturedMentors, getPlatformStats, getCategoryStats } from '../controllers/landingController';

const router = Router();

// Public routes (no authentication required)
router.get('/featured-mentors', getFeaturedMentors);
router.get('/platform-stats', getPlatformStats);
router.get('/category-stats', getCategoryStats);

export default router;
