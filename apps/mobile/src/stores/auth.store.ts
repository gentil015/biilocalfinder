import { create } from 'zustand';
import { authApi } from '@/src/services/api/endpoints/auth';
import { usersApi } from '@/src/services/api/endpoints/users';
import { workspacesApi } from '@/src/services/api/endpoints/workspaces';
import { tokenStore } from '@/src/services/storage/token-store';
import { signOutGoogle } from '@/src/services/auth/google';
import { useAppStore } from './app.store';
import type { AuthTokens, AuthUser, WorkspaceSummary } from '@/src/types/api';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  workspaces: WorkspaceSummary[];
  error: string | null;
  bootstrap: () => Promise<void>;
  signIn: (tokens: AuthTokens) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  selectWorkspace: (workspaceId: string) => Promise<void>;
  reset: () => void;
}

async function loadContext(): Promise<{ user: AuthUser; workspaces: WorkspaceSummary[] }> {
  const user = await usersApi.me();
  const workspaces = user.role === 'PROVIDER' ? await workspacesApi.list() : [];
  const cached = useAppStore.getState().activeWorkspaceId;
  const valid = workspaces.find((workspace) => workspace.id === cached && workspace.status === 'ACTIVE');
  const preferred = valid ?? workspaces.find((workspace) => workspace.role === 'OWNER' && workspace.status === 'ACTIVE');
  await useAppStore.getState().setActiveWorkspace(preferred?.id ?? null);
  return { user, workspaces };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  workspaces: [],
  error: null,

  bootstrap: async () => {
    set({ status: 'loading', error: null });
    const tokens = await tokenStore.read();
    if (!tokens) {
      set({ status: 'anonymous', user: null, workspaces: [] });
      return;
    }
    try {
      const { user, workspaces } = await loadContext();
      set({ status: 'authenticated', user, workspaces });
    } catch {
      await tokenStore.clear();
      set({ status: 'anonymous', user: null, workspaces: [] });
    }
  },

  signIn: async (tokens) => {
    set({ status: 'loading', error: null });
    await tokenStore.save(tokens);
    try {
      const { user, workspaces } = await loadContext();
      set({ status: 'authenticated', user, workspaces });
    } catch (error) {
      await tokenStore.clear();
      set({
        status: 'anonymous',
        user: null,
        workspaces: [],
        error: error instanceof Error ? error.message : 'Could not sign in',
      });
      throw error;
    }
  },

  signOut: async () => {
    const tokens = await tokenStore.read();
    if (tokens) {
      try {
        await authApi.logout(tokens.refreshToken);
      } catch {
        // Local session cleanup must succeed even if the server call fails.
      }
    }
    await signOutGoogle().catch(() => undefined);
    await tokenStore.clear();
    await useAppStore.getState().setActiveWorkspace(null);
    get().reset();
  },

  refreshUser: async () => {
    const { user, workspaces } = await loadContext();
    set({ user, workspaces });
  },

  selectWorkspace: async (workspaceId) => {
    await useAppStore.getState().setActiveWorkspace(workspaceId);
    set({});
  },

  reset: () => {
    set({ status: 'anonymous', user: null, workspaces: [], error: null });
  },
}));
