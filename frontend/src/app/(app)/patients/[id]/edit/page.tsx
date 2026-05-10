'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { PatientEditPage } from '@/components/patients/patient-edit-page';
import { PatientRegistrationEdit } from '@/components/patients/patient-registration-edit';

export default function PatientEditPageRoute() {
  const router = useRouter();
  const params = useParams();
  const patientId = params?.id as string | undefined;
  const { user, isAuthenticated, isInitializing, initialize } = useAuthStore();

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
    <div className="flex-1 flex flex-col overflow-y-auto">
      <div className="flex-1">
        {user?.role === 'SECRETARY' ? (
          <PatientRegistrationEdit key={patientId} patientId={patientId} />
        ) : (
          <PatientEditPage key={patientId} patientId={patientId} />
        )}
      </div>
    </div>
  );
}
