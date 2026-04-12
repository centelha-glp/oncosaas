'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { NavigationBar } from '@/components/shared/navigation-bar';
import { CANCER_TYPE_LABELS } from '@/lib/utils/patient-cancer-type';

interface ProfileData {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
  tenant?: {
    name: string;
    settings?: {
      enabledCancerTypes?: string[];
      [key: string]: unknown;
    } | null;
  };
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  ONCOLOGIST: 'Oncologista',
  DOCTOR: 'Médico',
  NURSE_CHIEF: 'Chefe de Enfermagem',
  NURSE: 'Enfermeiro(a)',
  COORDINATOR: 'Coordenador(a)',
};

/** Roles que podem editar configurações do tenant */
const SETTINGS_ALLOWED_ROLES = ['ADMIN', 'ONCOLOGIST', 'NURSE_CHIEF', 'COORDINATOR'];

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, isInitializing, initialize, setUser, user } =
    useAuthStore();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Cancer types
  const [enabledCancerTypes, setEnabledCancerTypes] = useState<string[]>([]);
  const [isSavingCancerTypes, setIsSavingCancerTypes] = useState(false);
  const [cancerTypesSuccess, setCancerTypesSuccess] = useState('');
  const [cancerTypesError, setCancerTypesError] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const canEditSettings = SETTINGS_ALLOWED_ROLES.includes(profile?.role ?? '');

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isInitializing, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    apiClient
      .get<ProfileData>('/auth/profile')
      .then((data) => {
        setProfile(data);
        setName(data.name);
        setEmail(data.email);
        setEnabledCancerTypes(
          data.tenant?.settings?.enabledCancerTypes ?? ['bladder'],
        );
      })
      .catch(() => setError('Erro ao carregar perfil.'))
      .finally(() => setIsLoading(false));
  }, [isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword && newPassword !== confirmPassword) {
      setError('As novas senhas não coincidem.');
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setIsSaving(true);

    try {
      const payload: Record<string, string> = {};
      if (name !== profile?.name) payload.name = name;
      if (email !== profile?.email) payload.email = email;
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      if (Object.keys(payload).length === 0) {
        setSuccess('Nenhuma alteração detectada.');
        return;
      }

      const updated = await apiClient.patch<ProfileData>(
        '/auth/profile',
        payload,
      );
      setProfile(updated);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Perfil atualizado com sucesso!');
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Erro ao salvar perfil.';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCancerType = (type: string) => {
    setEnabledCancerTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const handleSaveCancerTypes = async () => {
    setCancerTypesSuccess('');
    setCancerTypesError('');

    if (enabledCancerTypes.length === 0) {
      setCancerTypesError('Selecione pelo menos um tipo de câncer.');
      return;
    }

    setIsSavingCancerTypes(true);
    try {
      await apiClient.patch('/auth/tenant-settings', {
        enabledCancerTypes,
      });

      // Atualizar o user no store para refletir a mudança imediatamente
      if (user?.tenant) {
        setUser({
          ...user,
          tenant: {
            ...user.tenant,
            settings: {
              ...(user.tenant.settings ?? {}),
              enabledCancerTypes,
            },
          },
        });
        // Persistir no localStorage
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem('user');
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              parsed.tenant = {
                ...parsed.tenant,
                settings: {
                  ...(parsed.tenant?.settings ?? {}),
                  enabledCancerTypes,
                },
              };
              localStorage.setItem('user', JSON.stringify(parsed));
            } catch {
              // ignore
            }
          }
        }
      }

      setCancerTypesSuccess('Tipos de câncer atualizados com sucesso!');
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Erro ao salvar configuração.';
      setCancerTypesError(msg);
    } finally {
      setIsSavingCancerTypes(false);
    }
  };

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <NavigationBar />
        <div className="flex-1 flex items-center justify-center min-h-64">
          <p className="text-gray-500">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <NavigationBar />
      <div className="flex-1">
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
            <p className="text-sm text-gray-500 mt-1">
              {profile?.tenant?.name} &middot;{' '}
              {ROLE_LABELS[profile?.role || ''] || profile?.role}
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-6 bg-white rounded-lg border border-gray-200 p-6"
          >
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                {success}
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Informações básicas
              </h2>

              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Nome completo
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Alterar senha{' '}
                <span className="font-normal text-gray-400">(opcional)</span>
              </h2>

              <div>
                <label
                  htmlFor="currentPassword"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Senha atual
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Necessária apenas para alterar a senha"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Nova senha
                </label>
                <input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Confirmar nova senha
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </form>

          {!canEditSettings && profile && (
            <div
              className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600"
              role="note"
            >
              <p>
                As configurações da instituição (tipos de câncer habilitados na
                navegação oncológica) são alteradas apenas por perfis
                autorizados (ex.: administração ou coordenação). Em dúvida,
                procure o gestor da sua unidade.
              </p>
            </div>
          )}

          {/* Configurações do Tenant — apenas para roles permitidas */}
          {canEditSettings && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Configurações da Instituição
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Selecione os tipos de câncer habilitados para navegação nesta
                  instituição.
                </p>
              </div>

              {cancerTypesSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
                  {cancerTypesSuccess}
                </div>
              )}
              {cancerTypesError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                  {cancerTypesError}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(CANCER_TYPE_LABELS).map(([key, label]) => {
                  const checked = enabledCancerTypes.includes(key);
                  return (
                    <label
                      key={key}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors text-sm ${
                        checked
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCancerType(key)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      {label}
                    </label>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleSaveCancerTypes}
                  disabled={isSavingCancerTypes}
                >
                  {isSavingCancerTypes
                    ? 'Salvando...'
                    : 'Salvar tipos de câncer'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
