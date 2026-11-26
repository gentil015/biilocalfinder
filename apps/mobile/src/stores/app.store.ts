import { create } from 'zustand';
import { cacheStore } from '@/src/services/storage/token-store';
import type { SelectedLocation } from '@/src/types/api';

export type ActiveExperience = 'customer' | 'provider';

interface AppState {
  onboardingComplete: boolean;
  activeExperience: ActiveExperience | null;
  activeWorkspaceId: string | null;
  selectedLocation: SelectedLocation | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  setActiveExperience: (experience: ActiveExperience | null) => Promise<void>;
  setActiveWorkspace: (id: string | null) => Promise<void>;
  setSelectedLocation: (location: SelectedLocation | null) => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  onboardingComplete: false,
  activeExperience: null,
  activeWorkspaceId: null,
  selectedLocation: null,
  hydrated: false,

  hydrate: async () => {
    const [onboardingComplete, activeExperience, activeWorkspaceId, selectedLocation] = await Promise.all([
      cacheStore.get<boolean>('onboardingComplete'),
      cacheStore.get<ActiveExperience>('activeExperience'),
      cacheStore.get<string>('activeWorkspaceId'),
      cacheStore.get<SelectedLocation>('selectedLocation'),
    ]);
    set({
      onboardingComplete: Boolean(onboardingComplete),
      activeExperience,
      activeWorkspaceId,
      selectedLocation,
      hydrated: true,
    });
  },

  completeOnboarding: async () => {
    set({ onboardingComplete: true });
    await cacheStore.set('onboardingComplete', true);
  },

  setActiveExperience: async (experience) => {
    set({ activeExperience: experience });
    if (experience) await cacheStore.set('activeExperience', experience);
    else await cacheStore.remove('activeExperience');
  },

  setActiveWorkspace: async (id) => {
    set({ activeWorkspaceId: id });
    if (id) await cacheStore.set('activeWorkspaceId', id);
    else await cacheStore.remove('activeWorkspaceId');
  },

  setSelectedLocation: async (location) => {
    set({ selectedLocation: location });
    if (location) await cacheStore.set('selectedLocation', location);
    else await cacheStore.remove('selectedLocation');
  },
}));
