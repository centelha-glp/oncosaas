/**
 * Utilitário para detectar automaticamente o protocolo (HTTP/HTTPS)
 * e construir URLs da API e WebSocket dinamicamente.
 *
 * Funciona tanto em desenvolvimento (HTTP) quanto em produção/HTTPS.
 */

/**
 * Detecta o protocolo baseado na URL atual do navegador
 * @returns 'https' ou 'http'
 */
function detectProtocol(): 'https' | 'http' {
  // No servidor (SSR), usar variável de ambiente ou padrão HTTP
  if (typeof window === 'undefined') {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl?.startsWith('https://')) {
      return 'https';
    }
    return 'http';
  }

  // No cliente, detectar do protocolo atual da página
  const protocol = window.location.protocol;
  return protocol === 'https:' ? 'https' : 'http';
}

/**
 * Obtém a URL base da API
 * Prioridade:
 * 1. Variável de ambiente NEXT_PUBLIC_API_URL (se definida e completa)
 * 2. Protocolo detectado + localhost:3002
 */
export function getApiUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;

  // Se a variável de ambiente já tem protocolo completo, usar ela
  if (
    envUrl &&
    (envUrl.startsWith('http://') || envUrl.startsWith('https://'))
  ) {
    return envUrl;
  }

  // Caso contrário, detectar protocolo e construir URL
  const protocol = detectProtocol();
  const port = process.env.NEXT_PUBLIC_API_PORT || '3002';
  return `${protocol}://localhost:${port}`;
}

/**
 * Obtém a URL base do WebSocket
 * Prioridade:
 * 1. Variável de ambiente NEXT_PUBLIC_WS_URL (se definida e completa)
 * 2. Protocolo detectado (ws/wss) + localhost:3002
 */
export function getWebSocketUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_WS_URL;

  // Se a variável de ambiente já tem protocolo completo, usar ela
  if (envUrl && (envUrl.startsWith('ws://') || envUrl.startsWith('wss://'))) {
    return envUrl;
  }

  // Caso contrário, detectar protocolo e construir URL
  const protocol = detectProtocol();
  const wsProtocol = protocol === 'https' ? 'wss' : 'ws';
  const port = process.env.NEXT_PUBLIC_API_PORT || '3002';
  return `${wsProtocol}://localhost:${port}`;
}
