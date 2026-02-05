import express from 'express';
import * as broadcastController from '../controllers/broadcastController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = express.Router();

router.post('/', authenticate, requireAdmin, broadcastController.sendBroadcast);

export default router;
