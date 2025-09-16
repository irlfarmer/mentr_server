import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  createService,
  getServices,
  getService,
  updateService,
  deleteService,
  getServicesByMentor,
  getServiceCategories
} from '../controllers/serviceController';

const router = Router();

// Public routes (no authentication required)
router.get('/', getServices);
router.get('/categories', getServiceCategories);
router.get('/:id', getService);
router.get('/mentor/:mentorId', getServicesByMentor);

// Protected routes (require authentication)
router.post('/', authenticate as any, createService as any);
router.put('/:id', authenticate as any, updateService as any);
router.delete('/:id', authenticate as any, deleteService as any);

export default router;
