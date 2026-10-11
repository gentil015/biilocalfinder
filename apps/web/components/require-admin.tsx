'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, homeForRole } from '@/components/auth-provider';
import { LoadingBlock } from '@/components/ui/page';

/**
 * Client-side RBAC gate for the moderation surface (/admin/**).
 *
 * The API is the real boundary — every admin route is behind JwtAuthGuard +
 * RolesGuard — so this is UX, not security: without it a non-admin who types
 * /admin gets a screen full of failed requests and no explanation.
 *
 * Same two deliberate omissions as RequireProvider: it never reads the role
 * out of the JWT (forgeable, and goes stale), and it never redirects while
 * `loading`, which would bounce a signed-in admin to /login on hard refresh.
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'ADMIN') {
      // A non-admin has no business in the moderation surface. Send them to
      // the surface their own role actually owns.
      router.replace(homeForRole(user.role));
    }
  }, [loading, user, router]);

  if (loading || !user || user.role !== 'ADMIN') {
    return (
      <main className="page-narrow py-10">
        <LoadingBlock label="Checking your access…" />
      </main>
    );
  }

  return <>{children}</>;
}
