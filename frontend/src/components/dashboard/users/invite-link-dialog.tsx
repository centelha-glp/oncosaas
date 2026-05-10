'use client';

import { useEffect, useState } from 'react';
import { Link2, Loader2 } from 'lucide-react';
import { authApi } from '@/lib/api/auth';
import type { UserRole } from '@/lib/api/users';
import { ApiClientError } from '@/lib/api/client';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'ONCOLOGIST', label: 'Oncologista' },
  { value: 'DOCTOR', label: 'Médico' },
  { value: 'NURSE_CHIEF', label: 'Enfermeiro chefe' },
  { value: 'NURSE', label: 'Enfermeiro' },
  { value: 'COORDINATOR', label: 'Coordenador' },
  { value: 'SECRETARY', label: 'Secretaria' },
];

function buildInvitePageUrl(token: string): string {
  if (typeof window === 'undefined') return '';
  const base = window.location.origin.replace(/\/$/, '');
  return `${base}/invite?token=${encodeURIComponent(token)}`;
}

interface InviteLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteLinkDialog({ open, onOpenChange }: InviteLinkDialogProps) {
  const [role, setRole] = useState<UserRole>('NURSE');
  const [inviteUrl, setInviteUrl] = useState('');
  const [expiresIn, setExpiresIn] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setInviteUrl('');
      setExpiresIn('');
      setError('');
      setCopied(false);
      setRole('NURSE');
    }
  }, [open]);

  const handleGenerate = async () => {
    setError('');
    setCopied(false);
    setLoading(true);
    try {
      const res = await authApi.createInvite({ role });
      setInviteUrl(buildInvitePageUrl(res.inviteToken));
      setExpiresIn(res.expiresIn);
    } catch (e: unknown) {
      const msg =
        e instanceof ApiClientError
          ? e.message
          : 'Não foi possível gerar o convite.';
      setError(msg);
      setInviteUrl('');
      setExpiresIn('');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Não foi possível copiar. Selecione o link e copie manualmente.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>Link de convite</DialogTitle>
          <DialogDescription>
            Gere um link único para alguém criar conta nesta instituição com a
            função escolhida. O convite expira em 48 horas e só pode ser usado
            uma vez.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="invite-role">Função do novo usuário</Label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              disabled={loading || !!inviteUrl}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          {!inviteUrl ? (
            <Button
              type="button"
              className="w-full"
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando…
                </>
              ) : (
                'Gerar link de convite'
              )}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="invite-url">Link para enviar</Label>
                <Input
                  id="invite-url"
                  readOnly
                  value={inviteUrl}
                  className="font-mono text-xs"
                  onFocus={(e) => e.target.select()}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="default" onClick={handleCopy}>
                  <Link2 className="h-4 w-4 mr-2" />
                  {copied ? 'Copiado!' : 'Copiar link'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setInviteUrl('');
                    setExpiresIn('');
                    setCopied(false);
                  }}
                >
                  Gerar outro
                </Button>
              </div>
              {expiresIn && (
                <p className="text-xs text-muted-foreground">
                  Validade: {expiresIn}
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
