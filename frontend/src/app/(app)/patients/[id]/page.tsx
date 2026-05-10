'use client';

import { use, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { PatientDetailPage } from '@/components/patients/patient-detail-page';

type Params = Promise<{ id: string }>;

export default function PatientDetailRoute(props: { params: Params }) {
  const params = use(props.params);
  const router = useRouter();
  const { user, isAuthenticated, isInitializing, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isInitializing, router]);

  useEffect(() => {
    if (!isInitializing && isAuthenticated && user?.role === 'SECRETARY') {
      router.replace('/agenda');
    }
  }, [isInitializing, isAuthenticated, user?.role, router]);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <div className="flex-1">
        <Suspense
          fallback={
            <div className="p-6 text-center text-muted-foreground">
              Carregando…
            </div>
          }
        >
          <PatientDetailPage patientId={params.id} />
        </Suspense>
      </div>
    </div>
  );
}
