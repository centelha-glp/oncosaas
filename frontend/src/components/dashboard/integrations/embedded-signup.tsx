'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';
import { whatsappConnectionsApi } from '@/lib/api/whatsapp-connections';

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
  const [sdkReady, setSdkReady] = useState(false);
  const [httpsError, setHttpsError] = useState(false);
  // Refs para acesso síncrono no fbLoginCallback (state updates são async)
  const wabaIdRef = useRef<string | null>(null);
  const phoneNumberIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Facebook exige HTTPS desde 2018
    if (window.location.protocol !== 'https:') {
      setHttpsError(true);
      return;
    }

    const appId = process.env.NEXT_PUBLIC_META_APP_ID || '';
    if (!appId) {
      onError?.('NEXT_PUBLIC_META_APP_ID não configurado');
      return;
    }

    // Marca o SDK como pronto SOMENTE após FB.init() completar
    const markReady = () => setSdkReady(true);

    // fbAsyncInit é chamado pelo SDK quando o script carrega
    window.fbAsyncInit = () => {
      try {
        window.FB.init({
          appId,
          autoLogAppEvents: true,
          xfbml: true,
          version: process.env.NEXT_PUBLIC_META_API_VERSION || 'v25.0',
        });
        markReady();
      } catch (err) {
        console.error('Erro ao inicializar SDK do Facebook:', err);
        onError?.('Erro ao inicializar SDK do Facebook');
      }
    };

    const existingScript = document.getElementById('facebook-jssdk');

    if (existingScript) {
      // Script já carregado: FB pode já estar inicializado
      if (window.FB?.getLoginStatus) {
        markReady();
      }
      // Caso contrário, fbAsyncInit vai disparar quando terminar
      return;
    }

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => {
      console.error('Falha ao carregar SDK do Facebook');
      onError?.('Falha ao carregar SDK do Facebook. Verifique sua conexão.');
    };
    document.body.appendChild(script);

    // Listener de eventos WA_EMBEDDED_SIGNUP enviados via postMessage pelo iframe da Meta
    const messageListener = (event: MessageEvent) => {
      if (
        event.origin !== 'https://www.facebook.com' &&
        event.origin !== 'https://web.facebook.com' &&
        event.origin !== 'https://business.facebook.com'
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
            // Usar ref para acesso síncrono no fbLoginCallback
            if (data.data?.waba_id) wabaIdRef.current = data.data.waba_id;
            if (data.data?.phone_number_id) phoneNumberIdRef.current = data.data.phone_number_id;
          } else if (data.event === 'CANCEL') {
            onError?.(`Fluxo cancelado na etapa: ${data.data?.current_step || 'desconhecida'}`);
            setIsLoading(false);
          } else if (data.event === 'ERROR') {
            onError?.(data.data?.error_message || 'Erro no fluxo Meta');
            setIsLoading(false);
          }
        }
      } catch {
        // mensagens não-JSON (ignorar)
      }
    };

    window.addEventListener('message', messageListener);
    return () => window.removeEventListener('message', messageListener);
  }, [onError]);

  const handleEmbeddedSignup = () => {
    if (httpsError) {
      onError?.('Facebook Login requer HTTPS. Rode o frontend com: npm run dev:https');
      return;
    }

    if (!sdkReady || !window.FB) {
      onError?.('SDK do Facebook ainda não inicializado. Aguarde alguns segundos e tente novamente.');
      return;
    }

    setIsLoading(true);

    const configId = (
      process.env.NEXT_PUBLIC_META_CONFIG_ID ||
      process.env.NEXT_PUBLIC_META_APP_CONFIG_ID ||
      ''
    ).trim();

    if (!configId) {
      setIsLoading(false);
      onError?.(
        'NEXT_PUBLIC_META_CONFIG_ID não configurado. ' +
        'O ID vem de Facebook Login for Business → Configuration.'
      );
      return;
    }

    // redirect_uri deve ser idêntico ao registrado no app Meta e ao enviado ao backend
    const redirectUri = `${window.location.origin}${window.location.pathname}`.replace(/\/$/, '');

    const fbLoginCallback = (response: any) => {
      if (response.authResponse?.code) {
        (async () => {
          try {
            // Aguarda 500ms para garantir que o evento WA_EMBEDDED_SIGNUP FINISH
            // (enviado via postMessage pelo iframe da Meta) chegue antes de ler os refs.
            // O FB.login callback e o postMessage são assíncronos e podem chegar fora de ordem.
            await new Promise((resolve) => setTimeout(resolve, 500));

            const result = await whatsappConnectionsApi.processEmbeddedSignup(
              response.authResponse.code,
              // Quando usa SDK popup, o Meta não usa redirect_uri — omitir evita erro 36008
              undefined,
              wabaIdRef.current ?? undefined,
              phoneNumberIdRef.current ?? undefined
            );
            if (result.success) {
              onSuccess?.();
            } else {
              onError?.(result.message || 'Erro ao processar conexão');
            }
          } catch (err: any) {
            console.error('Erro ao processar Embedded Signup:', err);
            onError?.(err.message || 'Erro ao processar conexão');
          } finally {
            setIsLoading(false);
          }
        })();
      } else {
        setIsLoading(false);
        if (response.status === 'not_authorized') {
          onError?.('Usuário não autorizou o acesso ao app Meta');
        } else {
          onError?.('Usuário cancelou ou fechou a janela de autorização');
        }
      }
    };

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
            phone: { displayName: null, category: null, description: null },
            preVerifiedPhone: { ids: null },
            solutionID: null,
            whatsAppBusinessAccount: { ids: null },
          },
        },
      });
    } catch (err: any) {
      setIsLoading(false);
      console.error('Erro ao chamar FB.login:', err);
      onError?.(err.message || 'Erro ao iniciar conexão com Meta');
    }
  };

  if (httpsError) {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>
          Facebook Login requer HTTPS.{' '}
          <code className="text-xs font-mono bg-amber-100 px-1 rounded">npm run dev:https</code>
        </span>
      </div>
    );
  }

  return (
    <Button
      onClick={handleEmbeddedSignup}
      disabled={isLoading || !sdkReady}
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
          {!sdkReady ? 'Carregando SDK...' : 'Conectar com Meta (Embedded Signup)'}
        </>
      )}
    </Button>
  );
}
