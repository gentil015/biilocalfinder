'use client';

import { io, type Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

let socket: Socket | null = null;

// One shared socket per browser tab, authenticated with the same access
// token used for REST calls. Call disconnectSocket() on logout.
export function getSocket(): Socket | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('accessToken');
  if (!token) return null;

  if (!socket) {
    socket = io(API_URL, { auth: { token }, transports: ['websocket'] });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
