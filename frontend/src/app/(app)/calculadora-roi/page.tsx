'use client';

import { ROICalculator } from '@/components/roi-calculator/ROICalculator';
import { useAuthStore } from '@/stores/auth-store';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CalculadoraROIPage() {
  const { user, isAuthenticated, isInitializing, initialize } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isInitializing) {
      if (!isAuthenticated) {
        router.replace('/login');
        return;
      }

      // Redirecionar NURSE que tentar acessar calculadora ROI
      if (user && user.role === 'NURSE') {
        router.replace('/dashboard');
        return;
      }
    }
  }, [isAuthenticated, isInitializing, user, router]);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  // Não permitir acesso para NURSE
  if (user.role === 'NURSE') {
    return null;
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <div className="flex-1">
        <ROICalculator />
      </div>
    </div>
  );
}
