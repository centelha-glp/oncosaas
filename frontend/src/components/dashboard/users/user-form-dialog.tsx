'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateUser, useUpdateUser } from '@/hooks/useUsers';
import {
  User,
  UserRole,
  UpdateUserDto,
  CreateUserDto,
  ClinicalSubrole,
} from '@/lib/api/users';
import { useAuthStore } from '@/stores/auth-store';
import { BRAZIL_UF_SIGLAS } from '@/lib/constants/brazil-ufs';
import { needsCrm, needsCoren } from '@/lib/utils/user-professional-fields';

const UF_OPTIONS = BRAZIL_UF_SIGLAS as readonly string[];

const userSchema = z
  .object({
    name: z.string().min(1, 'Nome é obrigatório'),
    email: z.string().email('Email inválido'),
    password: z
      .string()
      .min(6, 'Senha deve ter no mínimo 6 caracteres')
      .optional()
      .or(z.literal('')),
    role: z.enum([
      'ADMIN',
      'ONCOLOGIST',
      'DOCTOR',
      'NURSE_CHIEF',
      'NURSE',
      'COORDINATOR',
      'SECRETARY',
    ]),
    clinicalSubrole: z.enum(['', 'NURSING', 'MEDICAL']),
    crmUf: z.string().optional(),
    crmNumber: z.string().optional(),
    corenUf: z.string().optional(),
    corenNumber: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const sub = data.clinicalSubrole as '' | ClinicalSubrole;
    if (needsCrm(data.role, sub)) {
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
    if (needsCoren(data.role, sub)) {
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

type UserFormData = z.infer<typeof userSchema>;

const roleOptions: { value: UserRole; label: string }[] = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'ONCOLOGIST', label: 'Oncologista' },
  { value: 'DOCTOR', label: 'Médico' },
  { value: 'NURSE_CHIEF', label: 'Enfermeiro Chefe' },
  { value: 'NURSE', label: 'Enfermeiro' },
  { value: 'COORDINATOR', label: 'Coordenador' },
  { value: 'SECRETARY', label: 'Secretaria' },
];

const clinicalSubroleOptions: {
  value: '' | ClinicalSubrole;
  label: string;
}[] = [
  { value: '', label: 'Não definido' },
  { value: 'NURSING', label: 'Enfermagem (evolução de enfermagem)' },
  { value: 'MEDICAL', label: 'Médica (evolução médica)' },
];

function clinicalSubroleForApi(
  role: UserRole,
  value: '' | ClinicalSubrole
): ClinicalSubrole | null | undefined {
  if (role !== 'COORDINATOR' && role !== 'ADMIN') return undefined;
  return value === '' ? null : value;
}

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User;
}

export function UserFormDialog({
  open,
  onOpenChange,
  user,
}: UserFormDialogProps) {
  const isEditing = !!user;
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const { user: currentUser } = useAuthStore();

  const canChangeRole = currentUser?.role === 'ADMIN';

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    control,
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'NURSE',
      clinicalSubrole: '',
      crmUf: '',
      crmNumber: '',
      corenUf: '',
      corenNumber: '',
    },
  });

  const role = useWatch({ control, name: 'role' });
  const clinicalSubroleWatch = useWatch({ control, name: 'clinicalSubrole' });
  const clinicalSubroleEffective =
    (clinicalSubroleWatch ?? '') as '' | ClinicalSubrole;

  useEffect(() => {
    if (!isEditing && !canChangeRole) {
      setValue('role', 'NURSE');
    }
  }, [isEditing, canChangeRole, setValue]);

  useEffect(() => {
    if (role !== 'COORDINATOR' && role !== 'ADMIN') {
      setValue('clinicalSubrole', '');
    }
  }, [role, setValue]);

  useEffect(() => {
    if (needsCrm(role, clinicalSubroleEffective)) {
      setValue('corenUf', '');
      setValue('corenNumber', '');
    } else if (needsCoren(role, clinicalSubroleEffective)) {
      setValue('crmUf', '');
      setValue('crmNumber', '');
    } else {
      setValue('crmUf', '');
      setValue('crmNumber', '');
      setValue('corenUf', '');
      setValue('corenNumber', '');
    }
  }, [role, clinicalSubroleEffective, setValue]);

  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        email: user.email,
        password: '',
        role: user.role,
        clinicalSubrole: user.clinicalSubrole ?? '',
        crmUf: user.crmUf ?? '',
        crmNumber: user.crmNumber ?? '',
        corenUf: user.corenUf ?? '',
        corenNumber: user.corenNumber ?? '',
      });
    } else {
      reset({
        name: '',
        email: '',
        password: '',
        role: canChangeRole ? 'NURSE' : 'NURSE',
        clinicalSubrole: '',
        crmUf: '',
        crmNumber: '',
        corenUf: '',
        corenNumber: '',
      });
    }
  }, [user, reset, open, canChangeRole]);

  const onSubmit = async (data: UserFormData): Promise<void> => {
    try {
      if (isEditing) {
        const updateData: UpdateUserDto = {
          name: data.name,
          email: data.email,
          role: data.role,
        };
        if (data.password && data.password.length > 0) {
          updateData.password = data.password;
        }
        const sub = clinicalSubroleForApi(data.role, data.clinicalSubrole);
        if (sub !== undefined) {
          updateData.clinicalSubrole = sub;
        }
        const subVal = data.clinicalSubrole as '' | ClinicalSubrole;
        if (needsCrm(data.role, subVal)) {
          updateData.crmUf = data.crmUf?.trim();
          updateData.crmNumber = data.crmNumber?.trim();
          updateData.corenUf = undefined;
          updateData.corenNumber = undefined;
        } else if (needsCoren(data.role, subVal)) {
          updateData.corenUf = data.corenUf?.trim();
          updateData.corenNumber = data.corenNumber?.trim();
          updateData.crmUf = undefined;
          updateData.crmNumber = undefined;
        }
        await updateUserMutation.mutateAsync({
          id: user!.id,
          data: updateData,
        });
      } else {
        if (!data.password || data.password.length < 6) {
          alert('Senha é obrigatória e deve ter no mínimo 6 caracteres');
          return;
        }
        const payload: CreateUserDto = {
          name: data.name,
          email: data.email,
          password: data.password,
          role: data.role,
        };
        const sub = clinicalSubroleForApi(data.role, data.clinicalSubrole);
        if (sub !== undefined) {
          payload.clinicalSubrole = sub;
        }
        const subVal = data.clinicalSubrole as '' | ClinicalSubrole;
        if (needsCrm(data.role, subVal)) {
          payload.crmUf = data.crmUf?.trim();
          payload.crmNumber = data.crmNumber?.trim();
        } else if (needsCoren(data.role, subVal)) {
          payload.corenUf = data.corenUf?.trim();
          payload.corenNumber = data.corenNumber?.trim();
        }
        await createUserMutation.mutateAsync(payload);
      }
      onOpenChange(false);
      reset();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : 'Erro ao salvar usuário. Tente novamente.';
      alert(errorMessage);
    }
  };

  const isLoading =
    createUserMutation.isPending || updateUserMutation.isPending;

  const showClinicalSubrole =
    role === 'COORDINATOR' || role === 'ADMIN';

  const showCrm = needsCrm(role, clinicalSubroleEffective);
  const showCoren = needsCoren(role, clinicalSubroleEffective);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">
          {isEditing ? 'Editar Usuário' : 'Novo Usuário'}
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Nome completo"
              autoComplete="name"
            />
            {errors.name && (
              <p className="text-sm text-red-600 mt-1" role="alert">
                {errors.name.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              placeholder="email@exemplo.com"
              autoComplete="email"
            />
            {errors.email && (
              <p className="text-sm text-red-600 mt-1" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="password">
              Senha {isEditing && '(deixe em branco para não alterar)'}
            </Label>
            <Input
              id="password"
              type="password"
              {...register('password')}
              placeholder={isEditing ? 'Nova senha (opcional)' : 'Senha'}
              autoComplete={isEditing ? 'new-password' : 'new-password'}
            />
            {errors.password && (
              <p className="text-sm text-red-600 mt-1" role="alert">
                {errors.password.message}
              </p>
            )}
            {!isEditing && (
              <p className="text-xs text-gray-500 mt-1">
                Mínimo de 6 caracteres
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="role">Função</Label>
            <select
              id="role"
              {...register('role')}
              disabled={!canChangeRole}
              aria-disabled={!canChangeRole}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                !canChangeRole
                  ? 'bg-gray-100 cursor-not-allowed opacity-60'
                  : ''
              }`}
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {!canChangeRole && (
              <p className="text-xs text-gray-500 mt-1">
                {isEditing
                  ? 'Apenas administradores podem alterar a função do usuário'
                  : 'Apenas administradores podem criar usuários com outras funções além de Enfermeiro'}
              </p>
            )}
            {errors.role && (
              <p className="text-sm text-red-600 mt-1" role="alert">
                {errors.role.message}
              </p>
            )}
          </div>

          {showClinicalSubrole && canChangeRole && (
            <div>
              <Label htmlFor="clinicalSubrole">
                Subpapel clínico (administrador ou coordenador)
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Define se este perfil pode assinar evoluções de enfermagem ou
                médicas no prontuário. Se escolher competência médica ou de
                enfermagem, informe o CRM ou COREN correspondente abaixo.
              </p>
              <select
                id="clinicalSubrole"
                {...register('clinicalSubrole')}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {clinicalSubroleOptions.map((option) => (
                  <option key={option.value || 'none'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.clinicalSubrole && (
                <p className="text-sm text-red-600 mt-1" role="alert">
                  {errors.clinicalSubrole.message}
                </p>
              )}
            </div>
          )}

          {showCrm && (
            <fieldset className="space-y-3 rounded-md border border-border p-3">
              <legend className="text-sm font-medium px-1">CRM</legend>
              <div>
                <Label htmlFor="crmUf">UF do CRM</Label>
                <select
                  id="crmUf"
                  {...register('crmUf')}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-invalid={errors.crmUf ? true : undefined}
                  aria-required
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
                <Label htmlFor="crmNumber">Número do CRM</Label>
                <Input
                  id="crmNumber"
                  {...register('crmNumber')}
                  placeholder="Número do registro"
                  autoComplete="off"
                  aria-invalid={errors.crmNumber ? true : undefined}
                  aria-required
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
                <Label htmlFor="corenUf">UF do COREN</Label>
                <select
                  id="corenUf"
                  {...register('corenUf')}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-invalid={errors.corenUf ? true : undefined}
                  aria-required
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
                <Label htmlFor="corenNumber">Número do COREN</Label>
                <Input
                  id="corenNumber"
                  {...register('corenNumber')}
                  placeholder="Número do registro"
                  autoComplete="off"
                  aria-invalid={errors.corenNumber ? true : undefined}
                  aria-required
                />
                {errors.corenNumber && (
                  <p className="text-sm text-red-600 mt-1" role="alert">
                    {errors.corenNumber.message}
                  </p>
                )}
              </div>
            </fieldset>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? 'Salvando...'
                : isEditing
                  ? 'Salvar Alterações'
                  : 'Criar Usuário'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
