'use client';

import { useEffect, useState } from 'react';
import { Lock, Mail, Phone } from 'lucide-react';
import { providersApi } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { AtAGlanceRow } from '@/components/at-a-glance-row';

type ProviderContact = { phone: string | null; email: string | null };

export function ProviderContactDetails({ providerId }: { providerId: string }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [contact, setContact] = useState<ProviderContact | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setContact(null);
    setChecking(true);

    if (!userId) {
      setChecking(false);
      return;
    }

    providersApi
      .getContact(providerId)
      .then((value) => {
        if (!cancelled) setContact(value);
      })
      .catch(() => {
        if (!cancelled) setContact(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [providerId, userId]);

  if (checking) return null;

  if (!contact?.phone && !contact?.email) {
    return (
      <AtAGlanceRow icon={Lock} label="Contact">
        Message in-app — phone and email unlock after a booking is accepted.
      </AtAGlanceRow>
    );
  }

  return (
    <>
      {contact.phone && (
        <AtAGlanceRow icon={Phone} label="Phone">
          <a
            href={`tel:${contact.phone}`}
            className="break-all text-brand-700 underline decoration-brand-200 underline-offset-2 hover:text-brand-900"
          >
            {contact.phone}
          </a>
        </AtAGlanceRow>
      )}
      {contact.email && (
        <AtAGlanceRow icon={Mail} label="Email">
          <a
            href={`mailto:${contact.email}`}
            className="break-all text-brand-700 underline decoration-brand-200 underline-offset-2 hover:text-brand-900"
          >
            {contact.email}
          </a>
        </AtAGlanceRow>
      )}
    </>
  );
}
