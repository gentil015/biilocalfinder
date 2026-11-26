let configured = false;

type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');

function getGoogleSigninModule(): GoogleSigninModule | null {
  try {
    // Lazy require prevents Expo Go / non-native contexts from crashing on app startup.
    return require('@react-native-google-signin/google-signin') as GoogleSigninModule;
  } catch {
    return null;
  }
}

export function isGoogleSignInConfigured() {
  return Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim());
}

export function isGoogleSignInAvailable() {
  return isGoogleSignInConfigured() && getGoogleSigninModule() !== null;
}

export function configureGoogleSignIn() {
  if (configured) return;
  const mod = getGoogleSigninModule();
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  if (!mod || !webClientId) return;
  mod.GoogleSignin.configure({
    webClientId,
    iosClientId: iosClientId || undefined,
    offlineAccess: false,
    profileImageSize: 256,
  });
  configured = true;
}

export async function signInWithGoogle(): Promise<string | null> {
  const mod = getGoogleSigninModule();
  if (!mod || !isGoogleSignInConfigured()) {
    throw new Error('Google Sign-In requires an EAS development or production build.');
  }
  configureGoogleSignIn();

  try {
    await mod.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await mod.GoogleSignin.signIn();
    if (response.type === 'cancelled') return null;
    const idToken = response.data?.idToken ?? (await mod.GoogleSignin.getTokens()).idToken;
    if (!idToken) throw new Error('Google did not return an ID token.');
    return idToken;
  } catch (error) {
    if (mod.isErrorWithCode(error) && error.code === mod.statusCodes.SIGN_IN_CANCELLED) return null;
    if (mod.isErrorWithCode(error) && error.code === mod.statusCodes.IN_PROGRESS) return null;
    if (mod.isErrorWithCode(error) && error.code === mod.statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Google Play Services are not available on this device.');
    }
    throw error instanceof Error ? error : new Error('Google sign-in failed.');
  }
}

export async function signOutGoogle() {
  if (!isGoogleSignInConfigured()) return;
  const mod = getGoogleSigninModule();
  if (!mod) return;
  configureGoogleSignIn();
  try {
    await mod.GoogleSignin.signOut();
  } catch {
    // Local app session must still clear even if Google SDK sign-out fails.
  }
}
