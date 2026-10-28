'use client';

import { io, type Socket } from 'socket.io-client';
import { isLoggedIn } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

let socket: Socket | null = null;

// One shared socket per browser tab. Authentication rides on the same
// HttpOnly access cookie as REST calls (withCredentials), never a token in
// JavaScript. Call disconnectSocket() on logout.
export function getSocket(): Socket | null {
  if (typeof window === 'undefined') return null;
  if (!isLoggedIn()) return null;

  if (!socket) {
    socket = io(API_URL, { withCredentials: true, transports: ['websocket'] });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
