import { Request, Response } from 'express';
import mongoose from 'mongoose';
import VideoCall, { IVideoCallDocument } from '../models/VideoCall';
import { Booking } from '../models/Booking';
import dailyService from '../services/dailyService';
import { AuthRequest } from '../types';

// Create video call room for a booking
export const createVideoCallRoom = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bookingId } = req.body;
    const userId = (req.user as any)?._id?.toString();



    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      res.status(400).json({ success: false, error: 'Valid booking ID is required' });
      return;
    }

    // Check if booking exists and user has access
    const booking = await Booking.findById(bookingId)
      .populate('serviceId')
      .populate('mentorId')
      .populate('studentId');

    if (!booking) {
      res.status(404).json({ success: false, error: 'Booking not found' });
      return;
    }

    // Verify user has access to this booking
    const mentorId = (booking.mentorId as any)?._id?.toString() || booking.mentorId.toString();
    const studentId = (booking.studentId as any)?._id?.toString() || booking.studentId.toString();
    
    const isMentor = mentorId === userId;
    const isStudent = studentId === userId;

    if (!isMentor && !isStudent) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    // CRITICAL: Check payment status before allowing video call creation
    if (booking.paymentStatus !== 'paid') {
      res.status(403).json({ 
        success: false, 
        error: 'Payment required. Please complete payment before joining the video call.',
        paymentRequired: true,
        paymentStatus: booking.paymentStatus
      });
      return;
    }

    // Check if video call already exists
    let videoCall = await VideoCall.findOne({ bookingId });

    if (videoCall) {
      res.status(200).json({
        success: true,
        data: {
          videoCall,
          roomUrl: videoCall.roomUrl,
        },
      });
      return;
    }

    // Generate unique room name
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const roomName = `mentr-${bookingId}-${timestamp}-${randomStr}`;

    // Create Daily.co room with booking duration and time restrictions
    const sessionDurationMinutes = booking.duration || 60; // Default 60 minutes if not specified
    const sessionStartTime = new Date(booking.scheduledAt);
    
    const dailyRoom = await dailyService.createRoom(roomName, {
      max_participants: 2,
      enable_recording: 'cloud',
      enable_transcription: true,
      enable_chat: true,
      enable_screenshare: true,
      enable_knocking: false,
      enable_prejoin_ui: true,
    }, sessionDurationMinutes, sessionStartTime);

    // Create video call record
    videoCall = new VideoCall({
      bookingId,
      roomName: dailyRoom.name,
      roomUrl: dailyRoom.url,
      mentorId: booking.mentorId._id,
      studentId: booking.studentId._id,
      scheduledAt: booking.scheduledAt,
      status: 'scheduled',
    });

    await videoCall.save();

    res.status(201).json({
      success: true,
      data: {
        videoCall,
        roomUrl: dailyRoom.url,
      },
    });
  } catch (error: any) {
    console.error('Create video call room error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create video call room',
    });
  }
};

// Get video call by booking ID
export const getVideoCallByBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const userId = (req.user as any)?._id?.toString();

    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      res.status(400).json({ success: false, error: 'Valid booking ID is required' });
      return;
    }

    // Find video call by booking ID
    const videoCall = await VideoCall.findOne({ bookingId })
      .populate('mentorId', 'firstName lastName profileImage')
      .populate('studentId', 'firstName lastName profileImage');

    if (!videoCall) {
      res.status(404).json({ success: false, error: 'Video call not found' });
      return;
    }

    // Verify user has access to this video call
    const mentorId = (videoCall.mentorId as any)?._id?.toString() || videoCall.mentorId.toString();
    const studentId = (videoCall.studentId as any)?._id?.toString() || videoCall.studentId.toString();
    
    const isMentor = mentorId === userId;
    const isStudent = studentId === userId;

    if (!isMentor && !isStudent) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    res.status(200).json({
      success: true,
      data: videoCall
    });
  } catch (error: any) {
    console.error('Error getting video call by booking:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get video call details
export const getVideoCall = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req.user as any)?._id?.toString();

    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: 'Valid video call ID is required' });
      return;
    }

    const videoCall = await VideoCall.findById(id)
      .populate('bookingId')
      .populate('mentorId', 'firstName lastName profileImage')
      .populate('studentId', 'firstName lastName profileImage');

    if (!videoCall) {
      res.status(404).json({ success: false, error: 'Video call not found' });
      return;
    }

    // Verify user has access
    if (!(videoCall as any).canJoin(userId)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    res.status(200).json({
      success: true,
      data: videoCall,
    });
  } catch (error: any) {
    console.error('Get video call error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get video call details',
    });
  }
};

// Generate meeting token for joining call
export const generateMeetingToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { videoCallId } = req.params;
    const userId = (req.user as any)?._id?.toString();

    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(videoCallId)) {
      res.status(400).json({ success: false, error: 'Valid video call ID is required' });
      return;
    }

    const videoCall = await VideoCall.findById(videoCallId)
      .populate('mentorId', 'firstName lastName')
      .populate('studentId', 'firstName lastName');

    if (!videoCall) {
      res.status(404).json({ success: false, error: 'Video call not found' });
      return;
    }

    // CRITICAL: Check payment status before allowing meeting token generation
    const booking = await Booking.findById(videoCall.bookingId);
    if (!booking) {
      res.status(404).json({ success: false, error: 'Associated booking not found' });
      return;
    }

    if (booking.paymentStatus !== 'paid') {
      res.status(403).json({ 
        success: false, 
        error: 'Payment required. Please complete payment before joining the video call.',
        paymentRequired: true,
        paymentStatus: booking.paymentStatus
      });
      return;
    }

    // Verify user can join
    if (!(videoCall as any).canJoin(userId)) {
      res.status(403).json({ success: false, error: 'Cannot join this call' });
      return;
    }

    // Determine user role and name
    const isMentor = videoCall.mentorId._id.toString() === userId;
    const user = isMentor ? videoCall.mentorId : videoCall.studentId;
    const userName = `${(user as any).firstName} ${(user as any).lastName}`;

    // Generate meeting token
    const meetingToken = await dailyService.createMeetingToken(
      videoCall.roomName,
      userId,
      userName,
      isMentor, // Mentor is owner
      120 // 2 hours expiration
    );

    res.status(200).json({
      success: true,
      data: {
        token: meetingToken.token,
        roomUrl: videoCall.roomUrl,
        userName,
        isOwner: isMentor,
      },
    });
  } catch (error: any) {
    console.error('Generate meeting token error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate meeting token',
    });
  }
};

// Start video call
export const startVideoCall = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { videoCallId } = req.params;
    const userId = (req.user as any)?._id?.toString();

    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const videoCall = await VideoCall.findById(videoCallId);

    if (!videoCall) {
      res.status(404).json({ success: false, error: 'Video call not found' });
      return;
    }

    if (!(videoCall as any).canJoin(userId)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    // Update call status
    videoCall.status = 'in_progress';
    videoCall.startedAt = new Date();
    await videoCall.save();

    res.status(200).json({
      success: true,
      data: videoCall,
    });
  } catch (error: any) {
    console.error('Start video call error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start video call',
    });
  }
};

// End video call
export const endVideoCall = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { videoCallId } = req.params;
    const { notes } = req.body;
    const userId = (req.user as any)?._id?.toString();

    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const videoCall = await VideoCall.findById(videoCallId);

    if (!videoCall) {
      res.status(404).json({ success: false, error: 'Video call not found' });
      return;
    }

    if (!(videoCall as any).canJoin(userId)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    // Update call status
    videoCall.status = 'completed';
    videoCall.endedAt = new Date();
    if (notes) {
      videoCall.notes = notes;
    }

    // Calculate duration
    if (videoCall.startedAt) {
      videoCall.duration = (videoCall as any).getDurationInMinutes();
    }

    await videoCall.save();

    res.status(200).json({
      success: true,
      data: videoCall,
    });
  } catch (error: any) {
    console.error('End video call error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to end video call',
    });
  }
};

// Get user's video calls
export const getUserVideoCalls = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)?._id?.toString();
    const { status, page = 1, limit = 10 } = req.query;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const query: any = {
      $or: [
        { mentorId: userId },
        { studentId: userId },
      ],
    };

    if (status) {
      query.status = status;
    }

    const videoCalls = await VideoCall.find(query)
      .populate('bookingId')
      .populate('mentorId', 'firstName lastName profileImage')
      .populate('studentId', 'firstName lastName profileImage')
      .sort({ scheduledAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await VideoCall.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        videoCalls,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error: any) {
    console.error('Get user video calls error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get video calls',
    });
  }
};

// Start recording with watermark
export const startRecording = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { videoCallId } = req.params;
    const userId = (req.user as any)?._id?.toString();

    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const videoCall = await VideoCall.findById(videoCallId);

    if (!videoCall) {
      res.status(404).json({ success: false, error: 'Video call not found' });
      return;
    }

    if (!(videoCall as any).canJoin(userId)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    // Only allow recording if call is in progress
    if (videoCall.status !== 'in_progress') {
      res.status(400).json({ success: false, error: 'Recording can only be started during an active call' });
      return;
    }

    // Start recording with watermark
    const recording = await dailyService.startRecordingWithWatermark(videoCall.roomName);

    // Update video call with recording info
    videoCall.recordingId = recording.id;
    videoCall.status = 'recording';
    await videoCall.save();

    res.status(200).json({
      success: true,
      data: {
        recordingId: recording.id,
        status: 'recording',
        message: 'Recording started with Mentr watermark'
      },
    });
  } catch (error: any) {
    console.error('Start recording error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start recording',
    });
  }
};

// Stop recording
export const stopRecording = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { videoCallId } = req.params;
    const userId = (req.user as any)?._id?.toString();

    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const videoCall = await VideoCall.findById(videoCallId);

    if (!videoCall) {
      res.status(404).json({ success: false, error: 'Video call not found' });
      return;
    }

    if (!(videoCall as any).canJoin(userId)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    if (!videoCall.recordingId) {
      res.status(400).json({ success: false, error: 'No active recording found' });
      return;
    }

    // Stop recording
    const recording = await dailyService.stopRecording(videoCall.recordingId);

    // Update video call status
    videoCall.status = 'in_progress'; // Back to in_progress after stopping recording
    await videoCall.save();

    res.status(200).json({
      success: true,
      data: {
        recordingId: videoCall.recordingId,
        status: 'stopped',
        message: 'Recording stopped successfully'
      },
    });
  } catch (error: any) {
    console.error('Stop recording error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop recording',
    });
  }
};
