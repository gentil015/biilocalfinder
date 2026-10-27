'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { favoritesApi } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';

export function FavoriteButton({ providerId, className }: { providerId: string; className?: string }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [favorited, setFavorited] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (loading) return;
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    setBusy(true);
    try {
      if (favorited) {
        await favoritesApi.remove(providerId);
        setFavorited(false);
      } else {
        await favoritesApi.add(providerId);
        setFavorited(true);
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.status === 403) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }
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
