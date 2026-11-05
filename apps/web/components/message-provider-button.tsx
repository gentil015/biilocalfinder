'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { messagingApi, ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';

/**
 * "Send a message" on a provider profile. Opens (or reuses) a direct
 * conversation thread with that provider and takes the client straight to
 * the chat — deliberately *not* a service request, so no booking is needed.
 */
export function MessageProviderButton({
  providerId,
  providerName,
  className,
  label = 'Send a message',
  showIcon = true,
}: {
  providerId: string;
  providerName?: string;
  className?: string;
  label?: string;
  showIcon?: boolean;
}) {
  const router = useRouter();
  // Session from context, not localStorage: reading localStorage here caused
  // hydration mismatches on this button.
  const { user, loading } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function launch() {
    if (loading || pending) return;
    if (!user) {
      router.push('/login');
      return;
    }

    setPending(true);
    setError(null);
    try {
      const conversation = await messagingApi.startConversation(providerId);
      router.push(`/messages/${conversation.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not open the conversation — please try again.',
      );
      setPending(false);
    }
  }

  const accessibleLabel = providerName ? `${label} ${providerName}` : label;

  return (
    <>
      <button
        type="button"
        onClick={launch}
        disabled={pending || loading}
        aria-label={accessibleLabel}
        className={className ?? 'btn-secondary'}
      >
        {showIcon && <MessageCircle className="h-4 w-4" aria-hidden="true" />}
        {pending ? 'Opening chat…' : label}
      </button>

      {error && (
        <p
          role="alert"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-lg bg-danger-50 px-3 py-2 text-center text-sm text-danger-700 shadow-lg"
        >
          {error}
        </p>
      )}
    </>
  );
}
