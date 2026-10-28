'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  authApi,
  clearTokens,
  isLoggedIn,
  setSession,
  usersApi,
  type AuthTokens,
} from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: 'CLIENT' | 'PROVIDER' | 'ADMIN';
  status: string;
  // BCP-47 tag from the account's `locale` column; see lib/locales.ts. Absent
  // from older API responses, which is why LocaleProvider re-resolves it.
  locale?: string;
}

interface AuthContextValue {
  user: SessionUser | null;
  // True until the initial /users/me probe settles. Guards must wait for this
  // before redirecting, or a signed-in PROVIDER gets bounced to /login on a
  // hard refresh simply because the role hadn't loaded yet.
  loading: boolean;
  login: (tokens: AuthTokens) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isLoggedIn()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await usersApi.me());
    } catch {
      // A 401 here means the session cookie is dead. request() already tried
      // to refresh it once; if that also failed it cleared the local hint, so
      // drop the user rather than leaving a phantom session behind.
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (tokens: AuthTokens) => {
      setSession(tokens);
      setLoading(true);
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    // Revoke server-side first, but never let a failure here trap the user in
    // a signed-in state they can't leave — the local clear is unconditional.
    await authApi.logout().catch(() => undefined);
    clearTokens();
    disconnectSocket();
    setUser(null);
    router.replace('/');
    router.refresh();
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/**
 * Where a freshly authenticated user of each role should land.
 *
 * This used to be decided ad hoc at each call site, and the copies disagreed:
 * login sent everyone to '/', registration sent ADMIN to '/dashboard', and
 * RequireAdmin sent non-admins to '/dashboard' or '/'. An ADMIN following
 * that trail reached /dashboard, which found no workspace for them and
 * bounced them to /provider/onboarding — a wizard a moderator can never
 * complete, because an admin holds no workspace and is not building a
 * provider profile. Moderators belong in /admin; that is the only surface
 * they actually have.
 */
export function homeForRole(role: SessionUser['role'] | null | undefined): string {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'PROVIDER':
      // Providers are workspace-scoped; /dashboard resolves the active
      // workspace or routes into onboarding, which is the correct entry
      // point for a provider who has not created one yet.
      return '/dashboard';
    case 'CLIENT':
    default:
      return '/';
  }
}

/** The role-aware helpers the UI actually needs, in one place. */
export function useSession() {
  const { user, loading } = useAuth();
  return {
    user,
    loading,
    // True only for a real PROVIDER. An ADMIN can reach provider surfaces
    // when they also own a provider profile, but that is a workspace
    // membership, not a property of the role — folding ADMIN in here is what
    // sent moderators into provider onboarding. Use `isAdmin` (below) or
    // `homeForRole` when the distinction matters.
    isProvider: user?.role === 'PROVIDER',
    isAdmin: user?.role === 'ADMIN',
    isClient: user?.role === 'CLIENT',
    home: homeForRole(user?.role),
  };
}
