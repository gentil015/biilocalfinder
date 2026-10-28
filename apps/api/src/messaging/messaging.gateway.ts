import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagingService } from './messaging.service';
import { SocketServerRegistry } from '../realtime/socket-server-registry.service';
import { ACCESS_COOKIE, getCookie } from '../auth/session-cookies';

interface AuthedSocket extends Socket {
  data: { userId: string };
}

// One online-presence counter per user (a user can have multiple tabs/
// devices open — only go "offline" when the last socket disconnects).
const onlineCounts = new Map<string, number>();

function socketOrigins(): string[] | boolean {
  const configured = process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean);
  if (configured?.length) return configured;
  return process.env.NODE_ENV === 'production' ? false : true;
}

@WebSocketGateway({ cors: { origin: socketOrigins(), credentials: true } })
export class MessagingGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger('MessagingGateway');

  @WebSocketServer() server: Server;

  constructor(
    private jwt: JwtService,
    private messagingService: MessagingService,
    private registry: SocketServerRegistry,
  ) {}

  afterInit(server: Server) {
    this.registry.setServer(server);
  }

  async handleConnection(socket: AuthedSocket) {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        getCookie(socket.handshake as any, ACCESS_COOKIE);
      if (!token) throw new UnauthorizedException();
      const payload = this.jwt.verify(token, { secret: process.env.JWT_SECRET });
      socket.data.userId = payload.sub;

      socket.join(SocketServerRegistry.userRoom(payload.sub));
      const count = (onlineCounts.get(payload.sub) ?? 0) + 1;
      onlineCounts.set(payload.sub, count);
      if (count === 1) {
        socket.broadcast.emit('presence:update', { userId: payload.sub, online: true });
      }
    } catch {
      this.logger.warn('Rejected unauthenticated socket connection');
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: AuthedSocket) {
    const userId = socket.data?.userId;
    if (!userId) return;
    const count = Math.max((onlineCounts.get(userId) ?? 1) - 1, 0);
    onlineCounts.set(userId, count);
    if (count === 0) {
      socket.broadcast.emit('presence:update', { userId, online: false });
    }
  }

  @SubscribeMessage('conversation:join')
  async onJoinConversation(@ConnectedSocket() socket: AuthedSocket, @MessageBody() conversationId: string) {
    await this.messagingService.assertParticipant(conversationId, socket.data.userId);
    socket.join(SocketServerRegistry.conversationRoom(conversationId));
  }

  @SubscribeMessage('typing')
  async onTyping(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: { conversationId: string; isTyping: boolean },
  ) {
    await this.messagingService.assertParticipant(payload.conversationId, socket.data.userId);
    socket
      .to(SocketServerRegistry.conversationRoom(payload.conversationId))
      .emit('typing', { userId: socket.data.userId, isTyping: payload.isTyping });
  }

  @SubscribeMessage('message:send')
  async onMessageSend(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: { conversationId: string; body: string },
  ) {
    if (typeof payload.body !== 'string' || payload.body.trim().length === 0 || payload.body.length > 5000) {
      throw new Error('Invalid message body');
    }
    const message = await this.messagingService.sendMessage(payload.conversationId, socket.data.userId, payload.body);
    this.registry.emitToRoom(SocketServerRegistry.conversationRoom(payload.conversationId), 'message:new', message);

    const otherUserIds = await this.messagingService.otherParticipantUserIds(
      payload.conversationId,
      socket.data.userId,
    );
    otherUserIds.forEach((uid) =>
      this.registry.emitToRoom(SocketServerRegistry.userRoom(uid), 'conversation:updated', {
        conversationId: payload.conversationId,
      }),
    );

    return message;
  }
}
