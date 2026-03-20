'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isInitializing, initialize } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Inicializar autenticação
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Verificar se já está autenticado (após inicialização)
  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isInitializing, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);

      // Aguardar um pouco para garantir que o estado foi atualizado
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Usar window.location.href para forçar reload completo e garantir redirecionamento
      if (typeof window !== 'undefined') {
        window.location.href = '/dashboard';
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Erro ao fazer login';
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            ONCONAV
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Faça login para acessar o dashboard
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </div>

          <div className="flex items-center justify-between text-sm">
            <Link
              href="/forgot-password"
              className="text-indigo-600 hover:text-indigo-500"
            >
              Esqueceu sua senha?
            </Link>
            <Link
              href="/"
              className="text-gray-500 hover:text-gray-700"
            >
              ← Voltar ao site
            </Link>
          </div>

          <div className="text-center text-sm text-gray-600">
            Ainda não tem conta?{' '}
            <Link
              href="/register"
              className="text-indigo-600 hover:text-indigo-500 font-medium"
            >
              Cadastre sua instituição
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
