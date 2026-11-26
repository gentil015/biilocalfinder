import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthTokens } from '@/src/types/api';

const ACCESS_KEY = 'bii.mobile.accessToken';
const REFRESH_KEY = 'bii.mobile.refreshToken';
const CACHE_PREFIX = 'bii.mobile.';

let cachedTokens: AuthTokens | null = null;

export const tokenStore = {
  async read(): Promise<AuthTokens | null> {
    if (cachedTokens) return cachedTokens;
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
    ]);
    if (!accessToken || !refreshToken) return null;
    cachedTokens = { accessToken, refreshToken };
    return cachedTokens;
  },

  async save(tokens: AuthTokens): Promise<void> {
    cachedTokens = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      ...(tokens.csrfToken ? { csrfToken: tokens.csrfToken } : {}),
    };
    await SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
  },

  async updateAccess(accessToken: string): Promise<void> {
    const current = await this.read();
    if (!current) return;
    await this.save({ ...current, accessToken });
  },

  async clear(): Promise<void> {
    cachedTokens = null;
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
    ]);
  },

  peekAccess(): string | null {
    return cachedTokens?.accessToken ?? null;
  },

  peekRefresh(): string | null {
    return cachedTokens?.refreshToken ?? null;
  },
};

export const cacheStore = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(value));
    } catch {
      // A non-sensitive cache failure must never break the app.
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
    } catch {
      // Ignore cache cleanup failures.
    }
  },

  async clearSessionData(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((key) => key.startsWith(CACHE_PREFIX) && !key.includes('onboarding'));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  },
};
