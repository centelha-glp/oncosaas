import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';

/**
 * Prova HMAC-SHA256(hex) alinhada ao ai-service (`X-Tenant-Auth`) para vincular
 * tenant ao mesmo segredo do Bearer (SEC-002) — não substitui JWT na borda Nest.
 */
export function buildTenantServiceProof(
  serviceToken: string,
  tenantId: string,
): string {
  return createHmac('sha256', serviceToken)
    .update(tenantId, 'utf8')
    .digest('hex');
}

/**
 * Retorna a URL base do ai-service e headers de autenticação para chamadas internas.
 * [C-01] Todas as chamadas backend → ai-service DEVEM usar este helper para garantir
 * que o Bearer token seja enviado quando BACKEND_SERVICE_TOKEN está configurado.
 */
export function getAiServiceConfig(configService: ConfigService): {
  aiServiceUrl: string;
  headers: Record<string, string>;
} {
  const aiServiceUrl =
    configService.get<string>('AI_SERVICE_URL') || 'http://localhost:8001';

  const serviceToken = configService.get<string>('BACKEND_SERVICE_TOKEN');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (serviceToken) {
    headers['Authorization'] = `Bearer ${serviceToken}`;
  }

  return { aiServiceUrl, headers };
}

/**
 * Headers para rotas do ai-service que também exigem X-Tenant-Id (ex.: observabilidade).
 * Quando BACKEND_SERVICE_TOKEN está definido, envia `X-Tenant-Auth` (HMAC do tenant).
 */
export function getAiServiceHeadersWithTenant(
  configService: ConfigService,
  tenantId: string,
): Record<string, string> {
  const { headers } = getAiServiceConfig(configService);
  const serviceToken = configService.get<string>('BACKEND_SERVICE_TOKEN');
  const out: Record<string, string> = {
    ...headers,
    'X-Tenant-Id': tenantId,
  };
  if (serviceToken?.length && tenantId) {
    out['X-Tenant-Auth'] = buildTenantServiceProof(serviceToken, tenantId);
  }
  return out;
}
