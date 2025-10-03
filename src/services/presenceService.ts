import { Server } from 'socket.io';
import { User } from '../models/User';

class PresenceService {
  private io: Server | null = null;
  private onlineUsers: Map<string, string> = new Map(); // userId -> socketId

  setSocketInstance(io: Server) {
    this.io = io;
  }

  // Set user as online
  async setUserOnline(userId: string, socketId: string) {
    try {
      // Update database
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
        lastSeen: new Date()
      });

      // Track in memory
      this.onlineUsers.set(userId, socketId);

      // Notify other users in conversations with this user
      await this.notifyPresenceChange(userId, true);
    } catch (error) {
      console.error('Error setting user online:', error);
    }
  }

  // Set user as offline
  async setUserOffline(userId: string) {
    try {
      // Update database
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen: new Date()
      });

      // Remove from memory
      this.onlineUsers.delete(userId);

      // Notify other users in conversations with this user
      await this.notifyPresenceChange(userId, false);
    } catch (error) {
      console.error('Error setting user offline:', error);
    }
  }

  // Check if user is online
  isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  // Get online status for multiple users
  async getUsersOnlineStatus(userIds: string[]) {
    try {
      const users = await User.find(
        { _id: { $in: userIds } },
        { _id: 1, isOnline: 1, lastSeen: 1 }
      );

      return users.map((user: any) => ({
        userId: user._id.toString(),
        isOnline: user.isOnline,
        lastSeen: user.lastSeen
      }));
    } catch (error) {
      console.error('Error getting users online status:', error);
      return [];
    }
  }

  // Notify presence change to relevant users
  private async notifyPresenceChange(userId: string, isOnline: boolean) {
    if (!this.io) return;

    try {
      // Get user's conversations
      const Message = require('../models/Message').default;
      const conversations = await Message.distinct('conversationId', {
        $or: [
          { senderId: userId },
          { receiverId: userId }
        ]
      });

      // Notify all users in these conversations
      for (const conversationId of conversations) {
        this.io.to(`conversation_${conversationId}`).emit('user-presence-changed', {
          userId,
          isOnline,
          lastSeen: new Date()
        });
      }
    } catch (error) {
      console.error('Error notifying presence change:', error);
    }
  }

  // Update last seen timestamp
  async updateLastSeen(userId: string) {
    try {
      await User.findByIdAndUpdate(userId, {
        lastSeen: new Date()
      });
    } catch (error) {
      console.error('Error updating last seen:', error);
    }
  }

  // Get socket ID for user
  getSocketId(userId: string): string | undefined {
    return this.onlineUsers.get(userId);
  }

  // Remove socket mapping
  removeSocketMapping(socketId: string) {
    for (const [userId, mappedSocketId] of this.onlineUsers.entries()) {
      if (mappedSocketId === socketId) {
        this.onlineUsers.delete(userId);
        this.setUserOffline(userId);
        break;
      }
    }
  }
}

export const presenceService = new PresenceService();
