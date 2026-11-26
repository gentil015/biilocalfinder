# Google Sign-In Setup (BII LocalFinder)

## OAuth Clients (Google Cloud Console)

Create these OAuth client IDs in the same Google Cloud project:

1. **Web application**
   - Use for: Next.js web app + backend ID token audience.
   - Authorized JavaScript origins:
     - `http://localhost:3000`
     - `https://biilocalfinder.com`
     - `https://www.biilocalfinder.com`
   - Authorized redirect URIs are not required for Google Identity Services ID token button flow, but keep origins exact.

2. **Android**
   - Package name: `com.biitechnologies.localfinder`
   - SHA-1: add debug and EAS/Play signing SHA-1 fingerprints.
   - Use this client for Android app identity; backend should still accept Web client ID as audience for native ID tokens.

3. **iOS**
   - Bundle ID: `com.biitechnologies.localfinder`
   - Copy the iOS client ID and reversed client ID URL scheme.

## Environment Variables

### API (`apps/api`)
- `GOOGLE_WEB_CLIENT_ID` - Web OAuth client ID (required).
- `GOOGLE_ANDROID_CLIENT_ID` - Android OAuth client ID (recommended).
- `GOOGLE_IOS_CLIENT_ID` - iOS OAuth client ID (recommended).
- `GOOGLE_ALLOWED_AUDIENCES` - optional comma-separated extra audiences.

### Web (`apps/web`)
- `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` - same Web OAuth client ID.

### Mobile (`apps/mobile`, EAS env/secrets)
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` - Web OAuth client ID (used as serverClientId/webClientId).
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` - iOS OAuth client ID.
- `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` - reversed iOS client ID, e.g. `com.googleusercontent.apps.123...`.

## Android SHA-1

Get debug SHA-1:
```bash
cd apps/mobile/android
./gradlew signingReport
```

For EAS:
```bash
cd apps/mobile
eas credentials -p android
```
Add the SHA-1 fingerprints shown by EAS/Play Console to the Android OAuth client in Google Cloud.

## iOS URL Scheme

Set `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` to the reversed iOS client ID from Google Cloud.  
`app.config.ts` injects it into `ios.infoPlist.CFBundleURLTypes`.

## EAS Builds

Google native sign-in requires a dev/prod build (not Expo Go).

```bash
cd apps/mobile
npm install
eas build --profile development --platform android
eas build --profile development --platform ios
eas build --profile production --platform android
eas build --profile production --platform ios
```

## Testing Checklist

- Web: login/register with Google, cancel popup, invalid token, logout/login.
- Android/iOS dev builds: new Google user, existing Google user, existing verified email/password account linking, cancel, Play Services unavailable/invalid config, logout/login.
- Backend: verify token audience/issuer, reject unverified email, no duplicate accounts by email/googleSub, preserve CLIENT/PROVIDER roles, never assign ADMIN.
