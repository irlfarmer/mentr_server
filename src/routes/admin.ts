import express from 'express';
import { 
  getAdminStats, 
  getRecentUsers, 
  getPendingVerifications, 
  getRecentTransactions, 
  getPlatformActivity,
  getAllUsers,
  updateUserStatus,
  verifyUser,
  getSystemAlerts,
  getUserAnalytics,
  getContentReports,
  handleReportAction,
  getRevenueByCategory,
  getUserDistribution,
  getUserGrowth,
  getUserProfile,
  updateUserVerification,
  getAllMentorEarnings,
  getPlatformStats,
  handleVerificationDecision,
  refundTransaction,
  processManualPayout,
  retryFailedTransaction,
  requireAdmin
} from '../controllers/adminController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// Dashboard stats
router.get('/stats', getAdminStats);

// User management
router.get('/users', getAllUsers);
router.get('/users/recent', getRecentUsers);
router.patch('/users/:userId/status', updateUserStatus);
router.patch('/users/:userId/verify', verifyUser);

// Verifications
router.get('/verifications/pending', getPendingVerifications);
router.post('/verifications/:requestId/decision', handleVerificationDecision);
router.post('/verifications/:requestId/approve', (req, res) => {
  req.body.decision = 'approve';
  handleVerificationDecision(req, res);
});
router.post('/verifications/:requestId/reject', (req, res) => {
  req.body.decision = 'reject';
  handleVerificationDecision(req, res);
});

// Transactions
router.get('/transactions/recent', getRecentTransactions);
router.post('/transactions/:transactionId/refund', refundTransaction);
router.post('/transactions/:transactionId/payout', processManualPayout);
router.post('/transactions/:transactionId/retry', retryFailedTransaction);

// Analytics
router.get('/activity', getPlatformActivity);
router.get('/analytics/users', getUserAnalytics);
router.get('/analytics/revenue-by-category', getRevenueByCategory);
router.get('/analytics/user-distribution', getUserDistribution);
router.get('/analytics/user-growth', getUserGrowth);

// Content Moderation
router.get('/reports', getContentReports);
router.post('/reports/:reportId/action', handleReportAction);

// System
router.get('/alerts', getSystemAlerts);

// User Profile Management
router.get('/users/:userId/profile', getUserProfile);
router.post('/users/:userId/verify', updateUserVerification);

// Earnings Management (handled by earnings routes)
// router.get('/earnings/all', getAllMentorEarnings);
// router.get('/earnings/platform-stats', getPlatformStats);

export default router;
