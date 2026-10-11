'use client';

import { RequireProvider } from '@/components/require-provider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <RequireProvider>{children}</RequireProvider>;
}
