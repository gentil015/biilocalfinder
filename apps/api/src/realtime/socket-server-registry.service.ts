import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

// A tiny, dependency-free holder for the one underlying Socket.IO server
// instance. MessagingGateway registers itself here on init; anything that
// needs to push a realtime event (notifications, quote/booking updates)
// depends on this registry instead of on MessagingGateway directly — which
// is what lets NotificationsModule and MessagingModule both push realtime
// events without importing each other.
@Injectable()
export class SocketServerRegistry {
  private server?: Server;

  setServer(server: Server) {
    this.server = server;
  }

  emitToRoom(room: string, event: string, payload: unknown) {
    this.server?.to(room).emit(event, payload);
  }

  static userRoom(userId: string) {
    return `user:${userId}`;
  }

  static conversationRoom(conversationId: string) {
    return `conversation:${conversationId}`;
  }
}
