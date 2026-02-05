import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { connectDB } from '../config/database';
import { setSocketInstance } from './services/socketService';
import { presenceService } from './services/presenceService';
import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';
import serviceRoutes from './routes/services';
import bookingRoutes from './routes/bookings';
import paymentRoutes from './routes/payments';
import messageRoutes from './routes/messages';
import videoCallRoutes from './routes/videoCalls';
import adminRoutes from './routes/admin';
import tokenRoutes from './routes/tokens';
import vcsRoutes from './routes/vcs';
import reviewRoutes from './routes/reviews';
import uploadRoutes from './routes/upload';
import earningsRoutes from './routes/earnings';
import disputeRoutes from './routes/disputes';
import payoutRoutes from './routes/payouts';
import stripeConnectRoutes from './routes/stripeConnect';
import landingRoutes from './routes/landing';
import fileRoutes from './routes/file';
import verificationRoutes from './routes/verification';
import passwordResetRoutes from './routes/passwordReset';
import notificationRoutes from './routes/notifications';
import notificationPreferencesRoutes from './routes/notificationPreferences';
import emailPreferencesRoutes from './routes/emailPreferences';
import webhookRoutes from './routes/webhooks';
import referralRoutes from './routes/referrals';
import noteRoutes from './routes/notes';
import reportRoutes from './routes/reports';
import supportRoutes from './routes/support';
import broadcastRoutes from './routes/broadcast';
import { CronService } from './services/cronService';
import { NoteCleanupService } from './services/noteCleanupService';
import { globalLimiter } from './middleware/rateLimit';

// Load environment variables
dotenv.config();

// Debug environment variables (commented out for production)
// console.log('Environment check:', {
//   NODE_ENV: process.env.NODE_ENV,
//   LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID,
//   LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET ? '***SET***' : 'NOT SET',
//   LINKEDIN_CALLBACK_URL: process.env.LINKEDIN_CALLBACK_URL
// });

// Import Passport after environment variables are loaded
// LinkedIn OAuth now handled by custom service

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      process.env.CLIENT_URL || 'http://localhost:3000',
      process.env.SERVER_URL || 'http://localhost:5000'
    ],
    methods: ['GET', 'POST']
  }
});

// Set Socket.io instance for use in other modules
setSocketInstance(io);
presenceService.setSocketInstance(io);

const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:3000',
    process.env.SERVER_URL || 'http://localhost:5000'
  ],
  credentials: true
}));

// Global Rate Limiter
app.use(globalLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Mentr API is running',
    timestamp: new Date().toISOString()
  });
});

// Webhook routes (must be before JSON parsing middleware)
app.use('/api/webhooks', webhookRoutes);

// JSON parsing middleware (after webhooks)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.JWT_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/mentr',
    touchAfter: 24 * 3600 // lazy session update
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// LinkedIn OAuth now handled by custom service - no Passport needed

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/video-calls', videoCallRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/earnings', earningsRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/stripe-connect', stripeConnectRoutes);
app.use('/api/landing', landingRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/password-reset', passwordResetRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/notification-preferences', notificationPreferencesRoutes);
app.use('/api/email-preferences', emailPreferencesRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/broadcast', broadcastRoutes);
app.use('/api', vcsRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Socket.io connection handling
io.on('connection', (socket: any) => {
  let currentUserId: string | null = null;

  // User joins their personal room for notifications
  socket.on('join-user-room', async (userId: string) => {
    socket.join(`user_${userId}`);
    currentUserId = userId;
    
    // Set user as online
    await presenceService.setUserOnline(userId, socket.id);
  });

  // Admin joins support room
  socket.on('join-admin-room', () => {
    socket.join('admin_support');
  });

  // Admin joins support room
  socket.on('join-admin-room', () => {
    socket.join('admin_support');
  });

  // User joins a conversation room
  socket.on('join-conversation', (conversationId: string) => {
    socket.join(`conversation_${conversationId}`);
  });

  // User leaves a conversation room
  socket.on('leave-conversation', (conversationId: string) => {
    socket.leave(`conversation_${conversationId}`);
  });

  // Handle typing indicators
  socket.on('typing-start', (data: { conversationId: string, userId: string }) => {
    socket.to(`conversation_${data.conversationId}`).emit('user-typing', {
      userId: data.userId,
      isTyping: true,
      conversationId: data.conversationId
    });
  });

  socket.on('typing-stop', (data: { conversationId: string, userId: string }) => {
    socket.to(`conversation_${data.conversationId}`).emit('user-typing', {
      userId: data.userId,
      isTyping: false,
      conversationId: data.conversationId
    });
  });

  // Admin typing indicators - emit to user's conversation room
  socket.on('admin-typing-start', (conversationId: string) => {
    socket.to(`conversation_${conversationId}`).emit('admin-typing', { isTyping: true });
  });

  socket.on('admin-typing-stop', (conversationId: string) => {
    socket.to(`conversation_${conversationId}`).emit('admin-typing', { isTyping: false });
  });

  // User typing with content - relay to admin for live preview
  socket.on('user-typing-with-content', (data: { conversationId: string; content: string; isTyping: boolean }) => {
    // Send to admin support room so admins can see what user is typing
    socket.to('admin_support').emit('user-typing-preview', {
      conversationId: data.conversationId,
      content: data.content,
      isTyping: data.isTyping
    });
  });

  // Handle message delivery
  socket.on('message-delivered', (data: { messageId: string, conversationId: string }) => {
    socket.to(`conversation_${data.conversationId}`).emit('message-delivered', {
      messageId: data.messageId
    });
  });

  // Handle user activity (update last seen)
  socket.on('user-activity', async (userId: string) => {
    await presenceService.updateLastSeen(userId);
  });

  socket.on('disconnect', async () => {
    // Set user as offline
    if (currentUserId) {
      await presenceService.setUserOffline(currentUserId);
    }
    presenceService.removeSocketMapping(socket.id);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Mentr Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API Base URL: http://localhost:${PORT}/api`);
  
  // Start cron jobs for automatic payouts
  CronService.startCronJobs();
  
  // Initialize note cleanup jobs
  NoteCleanupService.initializeCleanupJobs();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  CronService.stopCronJobs();
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  CronService.stopCronJobs();
  server.close(() => {
    console.log('Process terminated');
  });
});

export { app, io };
