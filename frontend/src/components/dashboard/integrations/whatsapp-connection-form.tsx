'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  CreateWhatsAppConnectionDto,
  WhatsAppConnection,
} from '@/lib/api/whatsapp-connections';
import { Loader2 } from 'lucide-react';

interface WhatsAppConnectionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateWhatsAppConnectionDto) => Promise<void>;
  connection?: WhatsAppConnection | null;
  mode: 'oauth' | 'manual';
}

export function WhatsAppConnectionForm({
  open,
  onOpenChange,
  onSubmit,
  connection,
  mode,
}: WhatsAppConnectionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateWhatsAppConnectionDto>({
    name: connection?.name || '',
    phoneNumber: connection?.phoneNumber || '',
    authMethod: mode === 'oauth' ? 'OAUTH' : 'MANUAL',
    apiToken: '',
    appId: '',
    appSecret: '',
    webhookUrl: '',
    webhookVerifyToken: '',
    isDefault: connection?.isDefault || false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit(formData);
      onOpenChange(false);
      // Reset form
      setFormData({
        name: '',
        phoneNumber: '',
        authMethod: 'MANUAL',
        apiToken: '',
        appId: '',
        appSecret: '',
        webhookUrl: '',
        webhookVerifyToken: '',
        isDefault: false,
      });
    } catch (error) {
      console.error('Erro ao enviar formulário:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (mode === 'oauth') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogClose onClose={() => onOpenChange(false)} />
          <DialogHeader>
            <DialogTitle>Conectar com Meta (OAuth)</DialogTitle>
            <DialogDescription>
              Você será redirecionado para autorizar o acesso à sua Business
              Manager. O nome da conexão será definido automaticamente após a
              autorização.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Como funciona:</strong>
              </p>
              <ol className="list-decimal list-inside text-sm text-blue-700 mt-2 space-y-1">
                <li>
                  Você será redirecionado para a página de autorização da Meta
                </li>
                <li>Autorize o acesso à sua Business Manager</li>
                <li>Seus números WhatsApp serão conectados automaticamente</li>
              </ol>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Iniciando...
                  </>
                ) : (
                  'Iniciar Autorização'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const editingConnection = !!connection;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>
            {editingConnection ? 'Editar Conexão' : 'Configuração Manual'}
          </DialogTitle>
          <DialogDescription>
            {editingConnection
              ? 'Atualize as configurações da conexão WhatsApp.'
              : 'Configure manualmente a conexão WhatsApp Business API.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome da Conexão *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Ex: WhatsApp Oncologia"
              required
            />
          </div>

          <div>
            <Label htmlFor="phoneNumber">Número de Telefone *</Label>
            <Input
              id="phoneNumber"
              value={formData.phoneNumber}
              onChange={(e) =>
                setFormData({ ...formData, phoneNumber: e.target.value })
              }
              placeholder="+5511999999999"
              required
              pattern="^\+[1-9]\d{1,14}$"
            />
            <p className="text-xs text-gray-500 mt-1">
              Formato internacional (ex: +5511999999999)
            </p>
          </div>

          <div>
            <Label htmlFor="apiToken">Token de Acesso *</Label>
            <Input
              id="apiToken"
              type="password"
              value={formData.apiToken}
              onChange={(e) =>
                setFormData({ ...formData, apiToken: e.target.value })
              }
              placeholder="Token de acesso da Meta"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="appId">App ID</Label>
              <Input
                id="appId"
                value={formData.appId}
                onChange={(e) =>
                  setFormData({ ...formData, appId: e.target.value })
                }
                placeholder="App ID da Meta"
              />
            </div>
            <div>
              <Label htmlFor="appSecret">App Secret</Label>
              <Input
                id="appSecret"
                type="password"
                value={formData.appSecret}
                onChange={(e) =>
                  setFormData({ ...formData, appSecret: e.target.value })
                }
                placeholder="App Secret da Meta"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="webhookUrl">Webhook URL</Label>
            <Input
              id="webhookUrl"
              type="url"
              value={formData.webhookUrl}
              onChange={(e) =>
                setFormData({ ...formData, webhookUrl: e.target.value })
              }
              placeholder="https://seu-dominio.com/webhooks/whatsapp"
            />
          </div>

          <div>
            <Label htmlFor="webhookVerifyToken">Webhook Verify Token</Label>
            <Input
              id="webhookVerifyToken"
              value={formData.webhookVerifyToken}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  webhookVerifyToken: e.target.value,
                })
              }
              placeholder="Token de verificação do webhook"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={formData.isDefault}
              onChange={(e) =>
                setFormData({ ...formData, isDefault: e.target.checked })
              }
              className="rounded border-gray-300"
            />
            <Label htmlFor="isDefault" className="cursor-pointer">
              Definir como conexão padrão
            </Label>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : connection ? (
                'Atualizar'
              ) : (
                'Criar Conexão'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
