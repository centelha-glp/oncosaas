'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { NavigationBar } from '@/components/shared/navigation-bar';
import { PatientEditPage } from '@/components/patients/patient-edit-page';

export default function PatientEditPageRoute() {
  const router = useRouter();
  const params = useParams();
  const patientId = params?.id as string | undefined;
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

  if (!patientId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600">ID do paciente não encontrado.</p>
          <button
            type="button"
            onClick={() => router.push('/patients')}
            className="mt-4 text-indigo-600 hover:underline"
          >
            Voltar para lista
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <NavigationBar />
      <div className="flex-1">
        <PatientEditPage key={patientId} patientId={patientId} />
      </div>
    </div>
  );
}
