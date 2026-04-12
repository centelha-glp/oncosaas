'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, MessageSquare, UserCircle } from 'lucide-react';

const STORAGE_KEY = 'onconav_welcome_onboarding_v1';

const STEPS = [
  {
    title: 'Bem-vindo ao ONCONAV',
    description:
      'O Dashboard reúne visão do turno, alertas e atalhos para a sua rotina clínica e operacional.',
    icon: LayoutDashboard,
  },
  {
    title: 'Chat em tempo real',
    description:
      'No Chat você opera o WhatsApp: lista de pacientes, alertas, decisões pendentes e devolução da conversa à IA quando fizer sentido.',
    icon: MessageSquare,
  },
  {
    title: 'Pacientes e navegação',
    description:
      'Em Pacientes você cadastra, importa e abre o prontuário. A Navegação Oncológica apoia etapas e protocolos do cuidado.',
    icon: UserCircle,
  },
] as const;

export function WelcomeOnboarding() {
  const { user, isAuthenticated } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);

  const complete = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore quota */
    }
    setOpen(false);
    setStep(0);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isAuthenticated || !user) return;
    try {
      const done = localStorage.getItem(STORAGE_KEY);
      setOpen(!done);
    } catch {
      setOpen(true);
    }
  }, [mounted, isAuthenticated, user]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      complete();
      return;
    }
    setOpen(next);
  };

  const isLast = step >= STEPS.length - 1;
  const Icon = STEPS[step].icon;

  if (!mounted) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-md"
        data-testid="welcome-onboarding"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogClose onClose={complete} />
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
            <Icon className="h-6 w-6" aria-hidden />
          </div>
          <DialogTitle className="text-center">{STEPS[step].title}</DialogTitle>
          <DialogDescription className="text-center text-base">
            {STEPS[step].description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center gap-1 pt-2" aria-hidden>
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-6 rounded-full ${
                i === step ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={complete}>
            Pular
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                Voltar
              </Button>
            )}
            {!isLast ? (
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  setStep((s) => Math.min(STEPS.length - 1, s + 1))
                }
              >
                Próximo
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={complete}>
                Começar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
