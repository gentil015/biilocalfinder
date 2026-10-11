'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/components/auth-provider';

/**
 * Client-side RBAC gate for the provider-only surfaces (/dashboard/**,
 * /provider/**).
 *
 * The API already enforces this — every workspace and onboarding route is
 * behind JwtAuthGuard + RolesGuard + WorkspaceMembershipGuard — so this is
 * UX, not security: without it a CLIENT who types /dashboard gets redirected
 * into /provider/onboarding, 403s on every call, and stares at a type-picker
 * whose Continue button can never work.
 *
 * Two things it deliberately does NOT do:
 *  - it doesn't read the role out of the JWT. That's forgeable client-side
 *    and would go stale; the role comes from GET /users/me.
 *  - it doesn't render on `loading`, because redirecting before the role is
 *    known would bounce a signed-in provider to /login on every hard refresh.
 */
export function RequireProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role === 'CLIENT') {
      // Clients have no workspace and no provider profile, so there is no
      // dashboard to land them on. Home is the only honest destination.
      router.replace('/');
      return;
    }
    if (user.role === 'ADMIN') {
      // A moderator who is not also a provider has no workspace and no
      // provider profile to build. /dashboard would find no memberships and
      // bounce them into /provider/onboarding — a wizard that can never be
      // completed by someone who isn't signing up as a provider. That was
      // the reported bug: an admin logging in and landing in provider
      // onboarding. Moderators go to /admin.
      router.replace('/admin');
    }
  }, [loading, user, router]);

  if (loading || !user || user.role !== 'PROVIDER') {
    return (
      <main className="page-narrow py-10 text-sm text-ink-400">
        Checking your access…
      </main>
    );
  }

  return <>{children}</>;
}
