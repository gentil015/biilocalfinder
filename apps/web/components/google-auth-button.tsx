'use client';

import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { useState } from 'react';
import { ApiError, authApi } from '@/lib/api';
import { useAuth, homeForRole } from '@/components/auth-provider';
import { CURRENT_TERMS_VERSION } from '@/lib/legal';

type Role = 'CLIENT' | 'PROVIDER';

export function GoogleAuthButton({
  mode,
  role = 'CLIENT',
  termsAccepted = false,
  next,
  onError,
}: {
  mode: 'login' | 'register';
  role?: Role;
  termsAccepted?: boolean;
  next?: string | null;
  onError?: (message: string) => void;
}) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const { login: adoptSession } = useAuth();
  const [loading, setLoading] = useState(false);

  if (!clientId) return null;

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <div className="mt-5">
        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-ink-200" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-surface px-3 text-ink-500">or continue with</span></div>
        </div>
        <div className={loading ? 'pointer-events-none opacity-70' : ''}>
          <GoogleLogin
            onSuccess={async (credentialResponse) => {
              const idToken = credentialResponse.credential;
              if (!idToken) {
                onError?.('Google sign-in did not return a credential.');
                return;
              }
              if (mode === 'register' && !termsAccepted) {
                onError?.('Accept the Terms and Conditions to create an account with Google.');
                return;
              }
              setLoading(true);
              try {
                const tokens = await authApi.google({
                  idToken,
                  ...(mode === 'register'
                    ? { role, termsAccepted: true as const, termsVersion: CURRENT_TERMS_VERSION }
                    : {}),
                });
                const me = await adoptSession(tokens).catch(() => null);
                if (!me) {
                  onError?.('Google sign-in succeeded, but the session could not be established.');
                  return;
                }
                window.location.assign(next ?? homeForRole(me.role));
              } catch (err) {
                onError?.(err instanceof ApiError ? err.message : 'Google sign-in failed. Please try again.');
              } finally {
                setLoading(false);
              }
            }}
            onError={() => onError?.('Google sign-in was cancelled or failed.')}
            useOneTap={mode === 'login'}
            theme="outline"
            shape="rectangular"
            size="large"
            width="100%"
            text={mode === 'register' ? 'signup_with' : 'signin_with'}
          />
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}
