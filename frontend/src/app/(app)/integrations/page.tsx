'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WhatsAppConnectionsList } from '@/components/dashboard/integrations/whatsapp-connections-list';
import { WhatsAppConnectionForm } from '@/components/dashboard/integrations/whatsapp-connection-form';
import { EmbeddedSignup } from '@/components/dashboard/integrations/embedded-signup';
import {
  whatsappConnectionsApi,
  CreateWhatsAppConnectionDto,
} from '@/lib/api/whatsapp-connections';
import { MessageSquare, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function IntegrationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isInitializing, initialize } = useAuthStore();
  const queryClient = useQueryClient();

  const [oauthFormOpen, setOauthFormOpen] = useState(false);
  const [processingRedirectCode, setProcessingRedirectCode] = useState(false);
  const processedCodeRef = useRef<string | null>(null);

  // Inicializar autenticação
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Verificar autenticação (após inicialização)
  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isInitializing, router]);

  // Verificar mensagens de sucesso/erro na URL
  useEffect(() => {
    const success = searchParams?.get('success');
    const error = searchParams?.get('error');

    if (success === 'true') {
      // Recarregar conexões
      queryClient.invalidateQueries({ queryKey: ['whatsapp-connections'] });
    }

    if (error) {
      // Mostrar erro (pode usar toast/alert)
      console.error('OAuth Error:', error);
    }
  }, [searchParams, queryClient]);

  // Fluxo de redirecionamento do Embedded Signup: Meta redireciona para redirect_uri?code=XXX
  // O código deve ser trocado por token via chamada servidor-para-servidor (backend)
  const redirectCode = searchParams?.get('code');
  useEffect(() => {
    if (!redirectCode || !isAuthenticated) return;
    if (processedCodeRef.current === redirectCode) return;

    processedCodeRef.current = redirectCode;
    setProcessingRedirectCode(true);

    const processRedirectCode = async () => {
      try {
        const redirectUri =
          typeof window !== 'undefined'
            ? `${window.location.origin}${window.location.pathname}`
            : undefined;
        const result = await whatsappConnectionsApi.processEmbeddedSignup(
          redirectCode,
          redirectUri
        );
        if (result.success) {
          queryClient.invalidateQueries({ queryKey: ['whatsapp-connections'] });
        } else {
          alert(`Erro ao conectar: ${result.message || 'Erro desconhecido'}`);
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Erro ao processar conexão';
        alert(`Erro ao conectar: ${msg}`);
      } finally {
        setProcessingRedirectCode(false);
        processedCodeRef.current = null;
        // Remove o code da URL (segurança: código de uso único)
        router.replace('/integrations', { scroll: false });
      }
    };

    processRedirectCode();
  }, [redirectCode, isAuthenticated, queryClient, router]);

  // Query para listar conexões
  const {
    data: connections = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['whatsapp-connections'],
    queryFn: () => whatsappConnectionsApi.getAll(),
    enabled: isAuthenticated,
  });

  // Mutation para deletar conexão
  const deleteMutation = useMutation({
    mutationFn: (id: string) => whatsappConnectionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-connections'] });
    },
  });

  // Mutation para testar conexão
  const testMutation = useMutation({
    mutationFn: (id: string) => whatsappConnectionsApi.test(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-connections'] });
    },
  });

  // Mutation para definir como padrão
  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => whatsappConnectionsApi.setDefault(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-connections'] });
    },
  });

  // Mutation para executar testes do Meta App Review
  const runMetaTestsMutation = useMutation({
    mutationFn: (id: string) => whatsappConnectionsApi.runMetaTests(id),
    onSuccess: (data) => {
      const summary = data?.summary || 'Testes executados.';
      const failed = data?.results
        ? Object.entries(data.results).filter(([, r]) => !r.success)
        : [];
      if (failed.length > 0) {
        const details = failed
          .map(([k, r]) => `${k}: ${r.detail || 'falhou'}`)
          .join('\n');
        alert(
          `${summary}\n\nPermissões com falha:\n${details}\n\nAlgumas permissões (ex: manage_app_solution) podem exigir Solution Partner.`
        );
      } else {
        alert(
          `${summary}\n\nAguarde alguns minutos e recarregue a página do App Review no Meta Developers.`
        );
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Erro ao executar testes';
      alert(`Erro: ${msg}`);
    },
  });

  // Mutation para iniciar OAuth
  const initiateOAuthMutation = useMutation({
    mutationFn: () => whatsappConnectionsApi.initiateOAuth(),
    onSuccess: (data) => {
      // Redirecionar para URL de autorização
      window.location.href = data.authorizationUrl;
    },
    onError: (error: any) => {
      console.error('Erro ao iniciar OAuth:', error);
      alert(`Erro ao conectar: ${error.message || 'Erro desconhecido'}`);
    },
  });

  const handleOAuthSubmit = async (_data: CreateWhatsAppConnectionDto) => {
    try {
      // Iniciar fluxo OAuth (nome será definido automaticamente após autorização)
      await initiateOAuthMutation.mutateAsync();
    } catch (error: any) {
      console.error('Erro ao iniciar OAuth:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      confirm(
        'Tem certeza que deseja deletar esta conexão? Esta ação não pode ser desfeita.'
      )
    ) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleTest = async (id: string) => {
    try {
      await testMutation.mutateAsync(id);
      alert('Teste realizado com sucesso!');
    } catch (error: any) {
      alert(`Erro ao testar conexão: ${error.message}`);
    }
  };

  const handleSetDefault = async (id: string) => {
    await setDefaultMutation.mutateAsync(id);
  };

  const handleRunMetaTests = async (id: string) => {
    await runMetaTestsMutation.mutateAsync(id);
  };

  if (isInitializing || processingRedirectCode) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600">
            {processingRedirectCode
              ? 'Conectando WhatsApp...'
              : 'Carregando...'}
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Integrações</h1>
          <p className="text-gray-600">
            Gerencie suas integrações com serviços externos
          </p>
        </div>

        {/* Seção WhatsApp Business API */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  WhatsApp Business API
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Conecte números WhatsApp à API oficial da Meta
                </p>
              </div>
              <div className="flex gap-2">
                <EmbeddedSignup
                  onSuccess={() => {
                    queryClient.invalidateQueries({
                      queryKey: ['whatsapp-connections'],
                    });
                  }}
                  onError={(error) => {
                    console.error('Erro no Embedded Signup:', error);
                    alert(`Erro ao conectar: ${error}`);
                  }}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Carregando conexões...</p>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertCircle className="h-5 w-5" />
                  <p>Erro ao carregar conexões</p>
                </div>
              </div>
            ) : (
              <WhatsAppConnectionsList
                connections={connections}
                onDelete={handleDelete}
                onTest={handleTest}
                onSetDefault={handleSetDefault}
                onRunMetaTests={handleRunMetaTests}
              />
            )}
          </CardContent>
        </Card>

        {/* Formulário OAuth */}
        <WhatsAppConnectionForm
          open={oauthFormOpen}
          onOpenChange={setOauthFormOpen}
          onSubmit={handleOAuthSubmit}
          mode="oauth"
        />
      </main>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-lg text-gray-600">Carregando...</p>
        </div>
      }
    >
      <IntegrationsPageContent />
    </Suspense>
  );
}
