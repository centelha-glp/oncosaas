'use client';

import { use, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { NavigationBar } from '@/components/shared/navigation-bar';
import { PatientDetailPage } from '@/components/patients/patient-detail-page';

type Params = Promise<{ id: string }>;

export default function PatientDetailRoute(props: { params: Params }) {
  const params = use(props.params);
  const router = useRouter();
  const { isAuthenticated, isInitializing, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isInitializing, router]);

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <NavigationBar />
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
