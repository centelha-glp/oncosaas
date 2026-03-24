'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { whatsappConnectionsApi } from '@/lib/api/whatsapp-connections';

// Tipos para o SDK do Facebook
declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

interface EmbeddedSignupProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function EmbeddedSignup({ onSuccess, onError }: EmbeddedSignupProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);

  // Carregar SDK do Facebook conforme documentação oficial
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const appId = process.env.NEXT_PUBLIC_META_APP_ID || '';

    if (!appId) {
      console.error('NEXT_PUBLIC_META_APP_ID não configurado');
      onError?.('Configuração do Meta App ID não encontrada');
      return;
    }

    // Verificar se já está carregado e inicializado
    if (window.FB && window.FB.getAuthResponse) {
      setSdkLoaded(true);
      return;
    }

    // SDK initialization conforme documentação oficial
    window.fbAsyncInit = () => {
      try {
        if (window.FB) {
          window.FB.init({
            appId: appId,
            autoLogAppEvents: true,
            xfbml: true,
            version: 'v25.0', // Graph API version conforme documentação Meta
          });
          setSdkLoaded(true);
        }
      } catch (error) {
        console.error('Erro ao inicializar SDK do Facebook:', error);
        onError?.('Erro ao inicializar SDK do Facebook');
      }
    };

    // Verificar se o script já foi carregado
    const existingScript = document.querySelector(
      'script[id="facebook-jssdk"]'
    );

    if (!existingScript) {
      // Carregar script do SDK conforme documentação oficial
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';

      script.onload = () => {
        // O SDK chama fbAsyncInit automaticamente quando carrega
        if (window.fbAsyncInit) {
          window.fbAsyncInit();
        }
      };

      script.onerror = () => {
        console.error('Erro ao carregar SDK do Facebook');
        onError?.('Erro ao carregar SDK do Facebook');
      };

      document.body.appendChild(script);
    } else {
      // Se o script já existe, aguardar e verificar se FB está disponível
      const checkInterval = setInterval(() => {
        if (window.FB && window.FB.getAuthResponse) {
          setSdkLoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.FB) {
          onError?.('SDK do Facebook não carregou após 5 segundos');
        }
      }, 5000);
    }

    // Listener de mensagens para capturar eventos WA_EMBEDDED_SIGNUP
    // Conforme doc Meta: https://www.facebook.com e https://web.facebook.com
    const messageListener = (event: MessageEvent) => {
      if (
        event.origin !== 'https://www.facebook.com' &&
        event.origin !== 'https://web.facebook.com'
      ) {
        return;
      }

      try {
        const data = JSON.parse(event.data);
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          if (
            data.event === 'FINISH' ||
            data.event === 'FINISH_ONLY_WABA' ||
            data.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'
          ) {
            // Fluxo completado com sucesso
            if (data.data?.waba_id && data.data?.phone_number_id) {
              console.log('WABA ID:', data.data.waba_id);
              console.log('Phone Number ID:', data.data.phone_number_id);
            }
          } else if (data.event === 'CANCEL') {
            const currentStep = data.data?.current_step || 'unknown';
            onError?.(`Fluxo cancelado na etapa: ${currentStep}`);
            setIsLoading(false);
          } else if (data.event === 'ERROR') {
            const errorMessage = data.data?.error_message || 'Erro no fluxo';
            onError?.(errorMessage);
            setIsLoading(false);
          }
        }
      } catch {
        // Ignorar erros de parsing (respostas não-JSON)
      }
    };

    window.addEventListener('message', messageListener);

    return () => {
      window.removeEventListener('message', messageListener);
    };
  }, [onError]);

  const handleEmbeddedSignup = () => {
    if (!sdkLoaded || !window.FB) {
      onError?.(
        'SDK do Facebook ainda não carregado. Aguarde alguns segundos.'
      );
      return;
    }

    setIsLoading(true);

    const configId = String(
      process.env.NEXT_PUBLIC_META_CONFIG_ID ||
        process.env.NEXT_PUBLIC_META_APP_CONFIG_ID ||
        ''
    ).trim();

    if (!configId) {
      setIsLoading(false);
      onError?.(
        'Meta Config ID não configurado. Defina NEXT_PUBLIC_META_APP_CONFIG_ID no .env.local. ' +
          'O ID deve vir de Facebook Login for Business → Configuration (WhatsApp Embedded Signup).'
      );
      return;
    }

    // redirect_uri DEVE ser idêntico ao usado no OAuth. Com FB.login, usar fallback_redirect_uri
    // para definir explicitamente o valor, e o mesmo na troca do código.
    // Normalizar removendo barra final para evitar divergência com backend.
    // Ref: https://stackoverflow.com/questions/77347825/facebook-javascript-sdk-oauth-redirect-uri-validation-issue
    const redirectUri =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}`.replace(
            /\/$/,
            ''
          )
        : '';

    const fbLoginCallback = (response: any) => {
      if (response.authResponse?.code) {
        (async () => {
          try {
            const result = await whatsappConnectionsApi.processEmbeddedSignup(
              response.authResponse.code,
              redirectUri
            );

            if (result.success) {
              onSuccess?.();
            } else {
              onError?.(result.message || 'Erro ao processar conexão');
            }
          } catch (error: any) {
            console.error('Erro ao processar Embedded Signup:', error);
            onError?.(error.message || 'Erro ao processar conexão');
          } finally {
            setIsLoading(false);
          }
        })();
      } else {
        setIsLoading(false);
        if (response.status === 'not_authorized') {
          onError?.('Usuário não autorizou o acesso');
        } else {
          onError?.('Usuário cancelou a autorização');
        }
      }
    };

    if (!redirectUri) {
      setIsLoading(false);
      onError?.('Não foi possível obter a URL da página. Verifique se está em HTTPS.');
      return;
    }

    try {
      window.FB.login(fbLoginCallback, {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        fallback_redirect_uri: redirectUri,
        extras: {
          version: 'v3',
          setup: {
            business: {
              id: null,
              name: null,
              email: null,
              phone: { code: null, number: null },
              website: null,
              address: {
                streetAddress1: null,
                streetAddress2: null,
                city: null,
                state: null,
                zipPostal: null,
                country: null,
              },
              timezone: null,
            },
            phone: {
              displayName: null,
              category: null,
              description: null,
            },
            preVerifiedPhone: { ids: null },
            solutionID: null,
            whatsAppBusinessAccount: { ids: null },
          },
        },
      });
    } catch (error: any) {
      setIsLoading(false);
      console.error('Erro ao iniciar Embedded Signup:', error);
      onError?.(error.message || 'Erro ao iniciar conexão');
    }
  };

  return (
    <Button
      onClick={handleEmbeddedSignup}
      disabled={isLoading || !sdkLoaded}
      variant="outline"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Conectando...
        </>
      ) : (
        <>
          <svg
            className="h-4 w-4 mr-2"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          Conectar com Meta (Embedded Signup)
        </>
      )}
    </Button>
  );
}
