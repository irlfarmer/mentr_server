import axios from 'axios';

export interface DailyRoom {
  id: string;
  name: string;
  api_created: boolean;
  privacy: 'private' | 'public';
  url: string;
  created_at: string;
  config: {
    start_video_off?: boolean;
    start_audio_off?: boolean;
    enable_recording?: string;
    enable_transcription?: boolean;
    max_participants?: number;
    enable_chat?: boolean;
    enable_screenshare?: boolean;
    enable_knocking?: boolean;
    enable_prejoin_ui?: boolean;
  };
}

export interface DailyMeetingToken {
  token: string;
  room_name: string;
  user_id?: string;
  user_name?: string;
  is_owner?: boolean;
  exp?: number;
}

class DailyService {
  private apiKey: string;
  private baseUrl = 'https://api.daily.co/v1';

  constructor() {
    this.apiKey = process.env.DAILY_API_KEY || '';
    if (!this.apiKey) {
      console.warn('DAILY_API_KEY not found in environment variables');
    }
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  // Create a new room
  async createRoom(roomName: string, config?: Partial<DailyRoom['config']>, sessionDuration?: number, sessionStartTime?: Date): Promise<DailyRoom> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const sessionDurationSeconds = sessionDuration ? sessionDuration * 60 : 90 * 60; // Default 90 minutes
      
      // Calculate NBF (Not Before) - allow joining 5 minutes before session start
      const sessionStartTimestamp = sessionStartTime ? Math.floor(sessionStartTime.getTime() / 1000) : now;
      const nbf = sessionStartTimestamp - (5 * 60); // 5 minutes before session start
      const exp = sessionStartTimestamp + sessionDurationSeconds; // Session end time
      
      const response = await axios.post(
        `${this.baseUrl}/rooms`,
        {
          name: roomName,
          privacy: 'private',
          properties: {
            start_video_off: config?.start_video_off || false,
            start_audio_off: config?.start_audio_off || false,
            enable_recording: config?.enable_recording || 'local',
            enable_transcription: config?.enable_transcription || false,
            max_participants: config?.max_participants || 10,
            enable_chat: config?.enable_chat !== false,
            enable_screenshare: config?.enable_screenshare !== false,
            enable_knocking: config?.enable_knocking || true,
            enable_prejoin_ui: config?.enable_prejoin_ui !== false,
            // Room time restrictions
            nbf: nbf, // Can't join before this time (5 min early)
            exp: exp, // Room expires at session end time
            eject_at_room_exp: true, // Automatically eject participants when room expires
          },
        },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error creating Daily.co room:', error.response?.data || error.message);
      throw new Error(`Failed to create room: ${error.response?.data?.error || error.message}`);
    }
  }

  // Get room details
  async getRoom(roomName: string): Promise<DailyRoom> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/rooms/${roomName}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error getting Daily.co room:', error.response?.data || error.message);
      throw new Error(`Failed to get room: ${error.response?.data?.error || error.message}`);
    }
  }

  // Delete a room
  async deleteRoom(roomName: string): Promise<void> {
    try {
      await axios.delete(
        `${this.baseUrl}/rooms/${roomName}`,
        { headers: this.getHeaders() }
      );
    } catch (error: any) {
      console.error('Error deleting Daily.co room:', error.response?.data || error.message);
      throw new Error(`Failed to delete room: ${error.response?.data?.error || error.message}`);
    }
  }

  // Create meeting token
  async createMeetingToken(
    roomName: string,
    userId?: string,
    userName?: string,
    isOwner = false,
    expirationMinutes = 60
  ): Promise<DailyMeetingToken> {
    try {
      const exp = Math.floor(Date.now() / 1000) + (expirationMinutes * 60);
      
      const response = await axios.post(
        `${this.baseUrl}/meeting-tokens`,
        {
          properties: {
            room_name: roomName,
            user_id: userId,
            user_name: userName,
            is_owner: isOwner,
            exp: exp,
          },
        },
        { headers: this.getHeaders() }
      );
      
      return {
        token: response.data.token,
        room_name: roomName,
        user_id: userId,
        user_name: userName,
        is_owner: isOwner,
        exp: exp,
      };
    } catch (error: any) {
      console.error('Error creating meeting token:', error.response?.data || error.message);
      throw new Error(`Failed to create meeting token: ${error.response?.data?.error || error.message}`);
    }
  }

  // List all rooms
  async listRooms(): Promise<DailyRoom[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/rooms`,
        { headers: this.getHeaders() }
      );
      return response.data.data || [];
    } catch (error: any) {
      console.error('Error listing Daily.co rooms:', error.response?.data || error.message);
      throw new Error(`Failed to list rooms: ${error.response?.data?.error || error.message}`);
    }
  }

  // Start recording with watermark
  async startRecordingWithWatermark(roomName: string): Promise<any> {
    try {
      const baseUrl = process.env.SERVER_URL || 'http://localhost:5000';
      
      const response = await axios.post(
        `${this.baseUrl}/recordings`,
        {
          room_name: roomName,
          layout: {
            preset: 'custom',
            session_assets: {
              logo: `${baseUrl}/api/vcs/watermark.svg`,
              logo_position: 'top-right',
              logo_size: 'small'
            },
            composition_params: {
              watermark: {
                url: `${baseUrl}/api/vcs/watermark.svg`,
                position: 'top-right',
                size: 'small'
              }
            }
          }
        },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error starting recording with watermark:', error.response?.data || error.message);
      throw new Error(`Failed to start recording: ${error.response?.data?.error || error.message}`);
    }
  }

  // Stop recording
  async stopRecording(recordingId: string): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/recordings/${recordingId}/stop`,
        {},
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error stopping recording:', error.response?.data || error.message);
      throw new Error(`Failed to stop recording: ${error.response?.data?.error || error.message}`);
    }
  }

  // Get recording details
  async getRecording(recordingId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/recordings/${recordingId}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error getting recording:', error.response?.data || error.message);
      throw new Error(`Failed to get recording: ${error.response?.data?.error || error.message}`);
    }
  }
}

export const dailyService = new DailyService();
export default dailyService;
