import type { ConfigContext, ExpoConfig } from 'expo/config';
import appJson from './app.json';

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = (appJson.expo ?? config) as ExpoConfig;
  const iosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim();

  return {
    ...base,
    ios: {
      ...base.ios,
      infoPlist: {
        ...(base.ios?.infoPlist ?? {}),
        ...(iosUrlScheme ? { CFBundleURLTypes: [{ CFBundleURLSchemes: [iosUrlScheme] }] } : {}),
      },
    },
  };
};
