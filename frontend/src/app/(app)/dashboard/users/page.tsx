'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { UserList } from '@/components/dashboard/users/user-list';
import { UserRole } from '@/lib/api/users';

export default function UsersPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitializing, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isInitializing) {
      if (!isAuthenticated) {
        router.replace('/login');
        return;
      }

      // Verificar se o usuário tem permissão para acessar esta página
      const allowedRoles: UserRole[] = ['ADMIN', 'NURSE_CHIEF', 'COORDINATOR'];
      if (user && !allowedRoles.includes(user.role)) {
        router.replace(
          user.role === 'SECRETARY'
            ? '/agenda'
            : '/dashboard'
        );
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

  const allowedRoles: UserRole[] = ['ADMIN', 'NURSE_CHIEF', 'COORDINATOR'];
  if (!allowedRoles.includes(user.role)) {
    return null;
  }

  return (
    <div className="flex-1 w-full flex flex-col bg-gray-100 overflow-y-auto">
      <main className="flex-1 p-6">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Gerenciamento de Usuários
            </h1>
            <p className="text-gray-600 mt-1">
              Gerencie os usuários da sua instituição
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <UserList />
          </div>
        </div>
      </main>
    </div>
  );
}
