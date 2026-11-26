const clean = (value?: string | null) => (value ? value.replace(/\/+$/, '') : '');

const defaultApiUrl = process.env.NODE_ENV === 'production'
  ? 'https://api.biilocalfinder.com'
  : 'http://localhost:4000';

export const API_URL = clean(process.env.EXPO_PUBLIC_API_URL) || defaultApiUrl;
export const SOCKET_URL = clean(process.env.EXPO_PUBLIC_SOCKET_URL) || API_URL;
export const APP_SCHEME = 'biilocalfinder';
export const API_TIMEOUT_MS = 15_000;
export const UPLOAD_TIMEOUT_MS = 60_000;
export const CURRENT_TERMS_VERSION = '1.0';
export const DEFAULT_CURRENCY = 'RWF';
export const DEFAULT_COUNTRY = 'Rwanda';

export const isProductionApi = API_URL.startsWith('https://');
