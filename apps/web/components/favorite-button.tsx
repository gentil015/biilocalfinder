'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { favoritesApi } from '@/lib/api';

export function FavoriteButton({ providerId, className }: { providerId: string; className?: string }) {
  const [favorited, setFavorited] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      if (favorited) {
        await favoritesApi.remove(providerId);
        setFavorited(false);
      } else {
        await favoritesApi.add(providerId);
        setFavorited(true);
      }
    } catch {
      // Most likely not logged in as a client — silently ignore; a real
      // app would redirect to /login here.
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed={favorited}
      className={
        className ??
        `btn w-full ${favorited ? 'border border-danger-200 bg-danger-50 text-danger-700' : 'btn-secondary'}`
      }
    >
      <Heart className={`h-4 w-4 ${favorited ? 'fill-danger-500 text-danger-500' : ''}`} aria-hidden="true" />
      {favorited ? 'Saved' : 'Save provider'}
    </button>
  );
}
