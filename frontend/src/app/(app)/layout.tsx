'use client';

import { useEffect } from 'react';
import { NavigationBar } from '@/components/shared/navigation-bar';
import { useAuthStore } from '@/stores/auth-store';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <NavigationBar />
      <main className="flex-1 min-h-0 flex flex-col">{children}</main>
    </div>
  );
}
