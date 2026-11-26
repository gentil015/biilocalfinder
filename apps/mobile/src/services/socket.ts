import { io, type Socket } from 'socket.io-client';
import { SOCKET_URL } from '@/src/constants/config';
import { tokenStore } from '@/src/services/storage/token-store';

let socket: Socket | null = null;

export async function connectSocket(): Promise<Socket | null> {
  const tokens = await tokenStore.read();
  if (!tokens?.accessToken) return null;
  if (socket?.connected) return socket;

  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token: tokens.accessToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      timeout: 10_000,
    });
    socket.on('reconnect_attempt', () => {
      const access = tokenStore.peekAccess();
      if (access && socket) socket.auth = { token: access };
    });
  } else {
    socket.auth = { token: tokens.accessToken };
    socket.connect();
  }
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}
