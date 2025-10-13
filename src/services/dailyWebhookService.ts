import { VideoCall } from '../models/VideoCall';
import { Booking } from '../models/Booking';
import { User } from '../models/User';
import mongoose from 'mongoose';

interface Participant {
  id: string;
  user_name?: string;
  user_id?: string;
  join_time?: string;
  leave_time?: string;
}

// Daily.co webhook event format (from their documentation)
interface DailyWebhookEvent {
  domain_name: string;
  room_name: string;
  room_url: string;
  user_name?: string;
  user_id?: string;
  is_owner?: boolean;
  owner_is_present?: boolean;
  first_non_owner_join?: boolean;
  meeting_session_id?: string;
  // For meeting ended events
  meeting_ended?: boolean;
  // For recording events
  recording?: {
    id: string;
    download_link?: string;
    status: string;
  };
  // For transcription events
  transcription?: {
    id: string;
    download_link?: string;
    status: string;
  };
}

export class DailyWebhookService {
  // Process incoming webhook events
  static async processWebhookEvent(event: DailyWebhookEvent): Promise<void> {
    try {

      // Determine event type based on Daily.co webhook format
      if (event.meeting_ended || event.first_non_owner_join === false) {
        // This could be a room ended event or other room event
        await this.handleRoomEnded(event);
      } else if (event.user_id && event.user_name) {
        // This is a participant joined event
        await this.handleParticipantJoined(event);
      } else {
      }
    } catch (error) {
      throw error;
    }
  }

  // Handle participant joined event
  private static async handleParticipantJoined(event: DailyWebhookEvent): Promise<void> {
    const { room_name, user_name, user_id, is_owner } = event;

    if (!user_id) {
      // No user_id in join event
      return;
    }

    // Find video call by room name
    const videoCall = await VideoCall.findOne({ roomName: room_name });
    if (!videoCall) {
      // Video call not found for room
      return;
    }

    // Create participant data in Daily.co format
    const participant = {
      id: user_id,
      user_name: user_name || 'Guest',
      user_id: user_id,
    };

    // Update participant tracking
    await this.updateParticipantTracking(videoCall, participant, 'joined');

    // Check if this is the first participant and update status to in_progress
    const currentParticipants = await this.getCurrentParticipants(videoCall);
    if (currentParticipants.length === 1) {
      videoCall.status = 'in_progress';
      videoCall.startedAt = new Date();
      await videoCall.save();
      
    }

  }

  // Handle participant left event
  private static async handleParticipantLeft(event: DailyWebhookEvent): Promise<void> {
    const { room_name, user_name, user_id } = event;

    if (!user_id) {
      // No user_id in leave event
      return;
    }

    // Find video call by room name
    const videoCall = await VideoCall.findOne({ roomName: room_name });
    if (!videoCall) {
      // Video call not found for room
      return;
    }

    // Create participant data
    const participant = {
      id: user_id,
      user_name: user_name || 'Guest',
      user_id: user_id,
    };

    // Update participant tracking
    await this.updateParticipantTracking(videoCall, participant, 'left');

  }

  // Handle room ended event
  private static async handleRoomEnded(event: DailyWebhookEvent): Promise<void> {
    const { room_name } = event;

    // Find video call by room name
    const videoCall = await VideoCall.findOne({ roomName: room_name });
    if (!videoCall) {
      // Video call not found for room
      return;
    }

    // Validate that both mentor and mentee participated
    const validationResult = await this.validateSessionCompletion(videoCall);
    
    if (validationResult.isValid) {
      // Mark session as completed
      videoCall.status = 'completed';
      videoCall.endedAt = new Date();
      
      // Calculate duration
      if (videoCall.startedAt) {
        videoCall.duration = Math.round(
          (videoCall.endedAt.getTime() - videoCall.startedAt.getTime()) / (1000 * 60)
        );
      }

      await videoCall.save();

      // Update booking status to completed
      await this.updateBookingStatus(videoCall, 'completed');

    } else {
      // Mark as no-show or incomplete
      videoCall.status = 'no_show';
      videoCall.endedAt = new Date();
      await videoCall.save();

    }
  }

  // Handle recording started event
  private static async handleRecordingStarted(event: DailyWebhookEvent): Promise<void> {
    const { room_name, recording } = event;

    if (!recording) {
      // No recording data in recording started event
      return;
    }

    const videoCall = await VideoCall.findOne({ roomName: room_name });
    if (!videoCall) {
      // Video call not found for room
      return;
    }

    videoCall.recordingId = recording.id;
    videoCall.status = 'recording';
    await videoCall.save();

  }

  // Handle recording uploaded event
  private static async handleRecordingUploaded(event: DailyWebhookEvent): Promise<void> {
    const { room_name, recording } = event;

    if (!recording || !recording.download_link) {
      // No recording download link in uploaded event
      return;
    }

    const videoCall = await VideoCall.findOne({ roomName: room_name });
    if (!videoCall) {
      // Video call not found for room
      return;
    }

    videoCall.recordingUrl = recording.download_link;
    await videoCall.save();

  }

  // Handle recording stopped event
  private static async handleRecordingStopped(event: DailyWebhookEvent): Promise<void> {
    const { room_name } = event;

    const videoCall = await VideoCall.findOne({ roomName: room_name });
    if (!videoCall) {
      // Video call not found for room
      return;
    }

    // Return to in_progress status after recording stops
    videoCall.status = 'in_progress';
    await videoCall.save();

  }

  // Handle transcription updated event
  private static async handleTranscriptionUpdated(event: DailyWebhookEvent): Promise<void> {
    const { room_name, transcription } = event;

    if (!transcription || !transcription.download_link) {
      // No transcription download link in updated event
      return;
    }

    const videoCall = await VideoCall.findOne({ roomName: room_name });
    if (!videoCall) {
      // Video call not found for room
      return;
    }

    videoCall.transcriptionUrl = transcription.download_link;
    await videoCall.save();

  }

  // Update participant tracking in video call
  private static async updateParticipantTracking(
    videoCall: any,
    participant: Participant,
    action: 'joined' | 'left'
  ): Promise<void> {
    // Initialize participants array if it doesn't exist
    if (!videoCall.participants) {
      videoCall.participants = [];
    }

    const participantData = {
      id: participant.id,
      userName: participant.user_name,
      userId: participant.user_id,
      joinedAt: action === 'joined' ? new Date() : undefined,
      leftAt: action === 'left' ? new Date() : undefined,
    };

    if (action === 'joined') {
      // Add or update participant
      const existingIndex = videoCall.participants.findIndex((p: any) => p.id === participant.id);
      if (existingIndex >= 0) {
        videoCall.participants[existingIndex] = participantData;
      } else {
        videoCall.participants.push(participantData);
      }
    } else if (action === 'left') {
      // Update participant leave time
      const participantIndex = videoCall.participants.findIndex((p: any) => p.id === participant.id);
      if (participantIndex >= 0) {
        videoCall.participants[participantIndex].leftAt = new Date();
      }
    }

    await videoCall.save();
  }

  // Get current active participants
  private static async getCurrentParticipants(videoCall: any): Promise<any[]> {
    if (!videoCall.participants) return [];
    
    return videoCall.participants.filter((p: any) => 
      p.joinedAt && !p.leftAt
    );
  }

  // Validate session completion (both mentor and mentee must have participated)
  private static async validateSessionCompletion(videoCall: any): Promise<{
    isValid: boolean;
    reason?: string;
  }> {
    const participants = await this.getCurrentParticipants(videoCall);
    
    if (participants.length === 0) {
      return { isValid: false, reason: 'No participants joined' };
    }

    // Get mentor and student IDs
    const mentorId = videoCall.mentorId._id ? videoCall.mentorId._id.toString() : videoCall.mentorId.toString();
    const studentId = videoCall.studentId._id ? videoCall.studentId._id.toString() : videoCall.studentId.toString();

    // Check if both mentor and student participated
    const mentorParticipated = participants.some((p: any) => p.userId === mentorId);
    const studentParticipated = participants.some((p: any) => p.userId === studentId);

    if (!mentorParticipated) {
      return { isValid: false, reason: 'Mentor did not join the session' };
    }

    if (!studentParticipated) {
      return { isValid: false, reason: 'Student did not join the session' };
    }

    return { isValid: true };
  }

  // Update booking status
  private static async updateBookingStatus(videoCall: any, status: string): Promise<void> {
    try {
      await Booking.findByIdAndUpdate(videoCall.bookingId, { status });
      
    } catch (error) {
      // Error updating booking status
    }
  }
}
