'use client';

import { useAuth } from '@/components/auth-provider';
import { LandingPage } from '@/components/home/landing-page';
import { MemberHome } from '@/components/home/member-home';
import { Skeleton } from '@/components/ui/page';

/**
 * Homepage dispatch.
 *
 * Two faces, deliberately not one: a logged-out visitor gets the marketing
 * landing (hero, catalogue, trust), while a signed-in member gets a personal
 * home built around their own data — quick actions, recent requests and the
 * recommendation rails. Nothing from the pre-login page is carried over, so
 * the transition from marketing to product is an actual hand-off, not a
 * decorated landing page.
 *
 * `loading` gates the render so a signed-in user on a hard refresh never
 * flashes the anonymous hero while /users/me resolves.
 */
export default function HomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="bg-canvas">
        <div className="page-shell space-y-6 py-10">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-6 w-full max-w-md" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </div>
      </main>
    );
  }

  return user ? <MemberHome /> : <LandingPage />;
}