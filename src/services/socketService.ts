import { Server } from 'socket.io';

let ioInstance: Server | null = null;

export const setSocketInstance = (io: Server) => {
  ioInstance = io;
};

export const getSocketInstance = (): Server | null => {
  return ioInstance;
};

export const emitToConversation = (conversationId: string, event: string, data: any) => {
  if (ioInstance) {
    ioInstance.to(`conversation_${conversationId}`).emit(event, data);
  }
};

export const emitToUser = (userId: string, event: string, data: any) => {
  if (ioInstance) {
    ioInstance.to(`user_${userId}`).emit(event, data);
  }
};
