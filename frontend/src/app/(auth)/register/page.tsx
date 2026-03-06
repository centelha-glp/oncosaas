'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type Step = 1 | 2;

export default function RegisterPage() {
  const router = useRouter();
  const { registerInstitution, isAuthenticated, isInitializing, initialize } =
    useAuthStore();

  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [institutionName, setInstitutionName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isInitializing, router]);

  const validateStep1 = (): boolean => {
    if (!institutionName.trim() || institutionName.trim().length < 2) {
      setError('O nome da instituição deve ter pelo menos 2 caracteres.');
      return false;
    }
    setError('');
    return true;
  };

  const handleNextStep = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || name.trim().length < 2) {
      setError('O nome deve ter pelo menos 2 caracteres.');
      return;
    }

    if (!email.trim()) {
      setError('O email é obrigatório.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setIsLoading(true);

    try {
      await registerInstitution({
        institutionName: institutionName.trim(),
        name: name.trim(),
        email: email.trim(),
        password,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      if (typeof window !== 'undefined') {
        window.location.href = '/dashboard';
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Erro ao cadastrar instituição';
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const stepIndicator = (
    <div className="flex items-center justify-center gap-3 mb-6">
      <div
        className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors ${
          step >= 1
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-200 text-gray-500'
        }`}
      >
        1
      </div>
      <div
        className={`w-12 h-0.5 transition-colors ${
          step >= 2 ? 'bg-indigo-600' : 'bg-gray-200'
        }`}
      />
      <div
        className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors ${
          step >= 2
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-200 text-gray-500'
        }`}
      >
        2
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-extrabold text-gray-900">
            ONCONAV
          </CardTitle>
          <CardDescription className="text-sm text-gray-600">
            {step === 1
              ? 'Cadastre sua instituição de saúde'
              : 'Dados do administrador da conta'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {stepIndicator}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="institutionName">
                  Nome da Instituição
                </Label>
                <Input
                  id="institutionName"
                  type="text"
                  placeholder="Ex: Hospital São Lucas"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-gray-500">
                  Nome do hospital, clínica ou centro de saúde
                </p>
              </div>

              <Button
                type="button"
                className="w-full"
                onClick={handleNextStep}
              >
                Continuar
              </Button>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Seu Nome Completo</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Ex: Dr. João Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="joao@hospital.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setStep(1);
                    setError('');
                  }}
                >
                  Voltar
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isLoading}
                >
                  {isLoading ? 'Cadastrando...' : 'Criar Conta'}
                </Button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-gray-500 space-y-2">
            <p>
              Já possui conta?{' '}
              <Link
                href="/login"
                className="text-indigo-600 hover:text-indigo-500 font-medium"
              >
                Faça login
              </Link>
            </p>
            <p>
              <Link
                href="/"
                className="text-gray-500 hover:text-gray-700"
              >
                ← Voltar ao site
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
