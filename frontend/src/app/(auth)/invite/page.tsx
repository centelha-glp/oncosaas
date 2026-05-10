'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/auth-store';
import type { RegisterDto } from '@/lib/api/auth';
import { authApi, type InvitePreviewResponse } from '@/lib/api/auth';
import { ApiClientError } from '@/lib/api/client';
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
import { BRAZIL_UF_SIGLAS } from '@/lib/constants/brazil-ufs';
import {
  needsCrm,
  needsCoren,
} from '@/lib/utils/user-professional-fields';
import type { ClinicalSubrole, UserRole } from '@/lib/api/users';
import { getPostLoginRedirectTarget } from '@/lib/utils/redirect';

const UF_OPTIONS = BRAZIL_UF_SIGLAS as readonly string[];

const clinicalSubroleOptions: {
  value: '' | ClinicalSubrole;
  label: string;
}[] = [
  { value: '', label: 'Não definido' },
  { value: 'NURSING', label: 'Enfermagem (evolução de enfermagem)' },
  { value: 'MEDICAL', label: 'Médica (evolução médica)' },
];

const INVITE_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  ONCOLOGIST: 'Oncologista',
  DOCTOR: 'Médico',
  NURSE_CHIEF: 'Enfermeiro chefe',
  NURSE: 'Enfermeiro',
  COORDINATOR: 'Coordenador',
  SECRETARY: 'Secretaria',
};

function buildInviteSchema(invitedRole: UserRole) {
  return z
    .object({
      name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
      email: z.string().email('Email inválido'),
      password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
      confirmPassword: z.string().min(6, 'Confirme a senha'),
      clinicalSubrole: z.enum(['', 'NURSING', 'MEDICAL']),
      crmUf: z.string().optional(),
      crmNumber: z.string().optional(),
      corenUf: z.string().optional(),
      corenNumber: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.password !== data.confirmPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'As senhas não coincidem',
          path: ['confirmPassword'],
        });
      }
      const sub = data.clinicalSubrole as '' | ClinicalSubrole;
      if (needsCrm(invitedRole, sub)) {
        const uf = data.crmUf?.trim() ?? '';
        if (!UF_OPTIONS.includes(uf)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Selecione a UF do CRM.',
            path: ['crmUf'],
          });
        }
        if (!data.crmNumber?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Informe o número do CRM.',
            path: ['crmNumber'],
          });
        }
      }
      if (needsCoren(invitedRole, sub)) {
        const uf = data.corenUf?.trim() ?? '';
        if (!UF_OPTIONS.includes(uf)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Selecione a UF do COREN.',
            path: ['corenUf'],
          });
        }
        if (!data.corenNumber?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Informe o número do COREN.',
            path: ['corenNumber'],
          });
        }
      }
    });
}

type InviteFormValues = z.infer<ReturnType<typeof buildInviteSchema>>;

function InviteForm({
  token,
  preview,
}: {
  token: string;
  preview: InvitePreviewResponse;
}) {
  const registerWithInvite = useAuthStore((s) => s.registerWithInvite);
  const invitedRole = preview.role as UserRole;

  const schema = useMemo(
    () => buildInviteSchema(invitedRole),
    [invitedRole]
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    setValue,
  } = useForm<InviteFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      clinicalSubrole: '',
      crmUf: '',
      crmNumber: '',
      corenUf: '',
      corenNumber: '',
    },
  });

  const clinicalSubroleWatch = useWatch({ control, name: 'clinicalSubrole' });
  const clinicalEffective = (clinicalSubroleWatch ?? '') as '' | ClinicalSubrole;

  const showClinicalSubrole =
    invitedRole === 'COORDINATOR' || invitedRole === 'ADMIN';
  const showCrm = needsCrm(invitedRole, clinicalEffective);
  const showCoren = needsCoren(invitedRole, clinicalEffective);

  useEffect(() => {
    if (needsCrm(invitedRole, clinicalEffective)) {
      setValue('corenUf', '');
      setValue('corenNumber', '');
    } else if (needsCoren(invitedRole, clinicalEffective)) {
      setValue('crmUf', '');
      setValue('crmNumber', '');
    }
  }, [invitedRole, clinicalEffective, setValue]);

  const [submitError, setSubmitError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (data: InviteFormValues) => {
    setSubmitError('');
    setIsLoading(true);
    try {
      const sub = data.clinicalSubrole as '' | ClinicalSubrole;
      const payload: RegisterDto = {
        inviteToken: token,
        name: data.name.trim(),
        email: data.email.trim(),
        password: data.password,
      };
      if (showClinicalSubrole) {
        payload.clinicalSubrole = sub === '' ? null : sub;
      }
      if (needsCrm(invitedRole, sub)) {
        payload.crmUf = data.crmUf?.trim();
        payload.crmNumber = data.crmNumber?.trim();
      }
      if (needsCoren(invitedRole, sub)) {
        payload.corenUf = data.corenUf?.trim();
        payload.corenNumber = data.corenNumber?.trim();
      }

      await registerWithInvite(payload);

      await new Promise((resolve) => setTimeout(resolve, 100));

      if (typeof window !== 'undefined') {
        const target = getPostLoginRedirectTarget(null, invitedRole);
        window.location.href = target;
      }
    } catch (err: unknown) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Não foi possível concluir o cadastro.';
      setSubmitError(message);
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-extrabold text-gray-900">
          Aceitar convite
        </CardTitle>
        <CardDescription className="text-sm text-gray-600">
          <span className="block font-medium text-gray-800">
            {preview.tenantName}
          </span>
          <span className="mt-1 block">
            Função: {INVITE_ROLE_LABELS[invitedRole] ?? invitedRole}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {submitError && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm"
            >
              {submitError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="invite-name">Nome completo</Label>
            <Input
              id="invite-name"
              {...register('name')}
              autoComplete="name"
              placeholder="Seu nome"
            />
            {errors.name && (
              <p className="text-sm text-red-600" role="alert">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              {...register('email')}
              autoComplete="email"
            />
            {errors.email && (
              <p className="text-sm text-red-600" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-password">Senha</Label>
            <Input
              id="invite-password"
              type="password"
              {...register('password')}
              autoComplete="new-password"
            />
            {errors.password && (
              <p className="text-sm text-red-600" role="alert">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-confirm">Confirmar senha</Label>
            <Input
              id="invite-confirm"
              type="password"
              {...register('confirmPassword')}
              autoComplete="new-password"
            />
            {errors.confirmPassword && (
              <p className="text-sm text-red-600" role="alert">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {showClinicalSubrole && (
            <div className="space-y-2">
              <Label htmlFor="invite-clinical-subrole">
                Subpapel clínico (coordenação / administração)
              </Label>
              <p className="text-xs text-muted-foreground">
                Define se poderá assinar evoluções de enfermagem ou médicas no
                prontuário. Se escolher competência médica ou de enfermagem,
                informe o CRM ou COREN abaixo.
              </p>
              <select
                id="invite-clinical-subrole"
                {...register('clinicalSubrole')}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {clinicalSubroleOptions.map((option) => (
                  <option key={option.value || 'none'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {showCrm && (
            <fieldset className="space-y-3 rounded-md border border-border p-3">
              <legend className="text-sm font-medium px-1">CRM</legend>
              <div>
                <Label htmlFor="invite-crm-uf">UF do CRM</Label>
                <select
                  id="invite-crm-uf"
                  {...register('crmUf')}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-invalid={errors.crmUf ? true : undefined}
                >
                  <option value="">Selecione a UF</option>
                  {BRAZIL_UF_SIGLAS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
                {errors.crmUf && (
                  <p className="text-sm text-red-600 mt-1" role="alert">
                    {errors.crmUf.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="invite-crm-num">Número do CRM</Label>
                <Input
                  id="invite-crm-num"
                  {...register('crmNumber')}
                  autoComplete="off"
                />
                {errors.crmNumber && (
                  <p className="text-sm text-red-600 mt-1" role="alert">
                    {errors.crmNumber.message}
                  </p>
                )}
              </div>
            </fieldset>
          )}

          {showCoren && (
            <fieldset className="space-y-3 rounded-md border border-border p-3">
              <legend className="text-sm font-medium px-1">COREN</legend>
              <div>
                <Label htmlFor="invite-coren-uf">UF do COREN</Label>
                <select
                  id="invite-coren-uf"
                  {...register('corenUf')}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-invalid={errors.corenUf ? true : undefined}
                >
                  <option value="">Selecione a UF</option>
                  {BRAZIL_UF_SIGLAS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
                {errors.corenUf && (
                  <p className="text-sm text-red-600 mt-1" role="alert">
                    {errors.corenUf.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="invite-coren-num">Número do COREN</Label>
                <Input
                  id="invite-coren-num"
                  {...register('corenNumber')}
                  autoComplete="off"
                />
                {errors.corenNumber && (
                  <p className="text-sm text-red-600 mt-1" role="alert">
                    {errors.corenNumber.message}
                  </p>
                )}
              </div>
            </fieldset>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Criando conta…' : 'Criar conta e entrar'}
          </Button>

          <p className="text-center text-sm text-gray-500">
            Já tem conta?{' '}
            <Link
              href="/login"
              className="text-indigo-600 hover:text-indigo-500 font-medium"
            >
              Entrar
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

function InvitePageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';

  const [preview, setPreview] = useState<InvitePreviewResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(!!token);

  const { isAuthenticated, isInitializing, initialize } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isInitializing, router]);

  useEffect(() => {
    if (!token) {
      setLoadingPreview(false);
      return;
    }

    let cancelled = false;
    setLoadingPreview(true);
    setLoadError(null);

    authApi
      .invitePreview(token)
      .then((data) => {
        if (!cancelled) {
          setPreview(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message =
            err instanceof ApiClientError
              ? err.message
              : 'Não foi possível carregar o convite.';
          setLoadError(message);
          setPreview(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingPreview(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Convite inválido</CardTitle>
          <CardDescription>
            Abra o link completo enviado por email ou copie o endereço com o
            parâmetro <code className="text-xs">token</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/login"
            className="text-indigo-600 hover:text-indigo-500 text-sm font-medium"
          >
            Voltar ao login
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (loadingPreview) {
    return (
      <p className="text-sm text-gray-600 text-center py-8">
        Carregando convite…
      </p>
    );
  }

  if (loadError || !preview) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Não foi possível usar este convite</CardTitle>
          <CardDescription>{loadError ?? 'Convite indisponível.'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            O link pode ter expirado (48 horas) ou já ter sido utilizado.
            Peça um novo convite ao administrador da instituição.
          </p>
          <Link
            href="/login"
            className="inline-block text-indigo-600 hover:text-indigo-500 text-sm font-medium"
          >
            Ir para o login
          </Link>
        </CardContent>
      </Card>
    );
  }

  return <InviteForm token={token} preview={preview} />;
}

export default function InvitePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <Suspense
        fallback={
          <p className="text-sm text-gray-600">Carregando…</p>
        }
      >
        <InvitePageContent />
      </Suspense>
    </div>
  );
}
