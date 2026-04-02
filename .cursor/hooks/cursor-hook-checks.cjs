/**
 * Regras espelhadas de .claude/hooks/*.sh (tenant, LGPD, console.log)
 * para uso em cursor-hook-runner.cjs (afterFileEdit).
 */

const PRISMA_CALL_RE =
  /prisma\.\w+\.(findMany|findFirst|findUnique|findFirstOrThrow|findUniqueOrThrow|update|updateMany|delete|deleteMany|count|aggregate|groupBy|upsert)\s*\(/;

const SENSITIVE_FIELDS = [
  'password',
  'mfaSecret',
  'anthropicApiKey',
  'openaiApiKey',
  'oauthAccessToken',
  'twilioAuthToken',
  'vapiApiKey',
  'elevenLabsApiKey',
  'encryptionKey',
];

function norm(p) {
  return String(p || '').replace(/\\/g, '/');
}

function isBackendServiceOrController(fp) {
  const n = norm(fp);
  return (
    n.includes('backend/src/') &&
    (n.endsWith('.service.ts') || n.endsWith('.controller.ts'))
  );
}

function skipTenantPath(fp) {
  const n = norm(fp);
  return (
    /prisma\.service/i.test(n) ||
    /app\.module/i.test(n) ||
    /\/main\.ts$/i.test(n)
  );
}

/**
 * Espelha pre-tool-tenant-check.sh
 */
function checkTenant(content, filePath) {
  const fp = norm(filePath);
  if (!isBackendServiceOrController(fp) || skipTenantPath(fp)) {
    return { ok: true };
  }
  if (!PRISMA_CALL_RE.test(content)) {
    return { ok: true };
  }
  if (!content.includes('tenantId')) {
    return {
      ok: false,
      message: [
        '⚠️  ALERTA MULTI-TENANT: O código contém chamadas Prisma sem referência a tenantId.',
        '',
        "Toda query Prisma no backend DEVE incluir tenantId no where (ou contexto equivalente)",
        'para garantir isolamento de dados entre tenants.',
        '',
        'Exemplo:',
        '  await this.prisma.patient.findMany({',
        '    where: { tenantId, ...otherFilters }',
        '  });',
        '',
        `Arquivo: ${fp}`,
        '',
        'Referência: backend/src/auth/guards/tenant.guard.ts',
      ].join('\n'),
    };
  }
  return { ok: true };
}

function isLgpdTargetPath(fp) {
  const n = norm(fp).toLowerCase();
  if (!n.includes('backend/src/')) return false;
  const isController = n.endsWith('.controller.ts');
  const isResponseDto =
    (n.includes('response') && n.includes('.dto.ts')) ||
    (n.includes('dto') && n.includes('response'));
  return isController || isResponseDto;
}

function lgpdExcludePattern(field) {
  const f = escapeRe(field);
  return new RegExp(
    `(select[^\\n]*${f}[^\\n]*false|@Exclude[^\\n]*${f}|omit[^\\n]*${f}|exclude[^\\n]*${f})`,
    'i',
  );
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Espelha pre-tool-lgpd-check.sh
 */
function checkLgpd(content, filePath) {
  if (!isLgpdTargetPath(filePath)) {
    return { ok: true };
  }
  const violations = [];
  for (const field of SENSITIVE_FIELDS) {
    const word = new RegExp(`\\b${escapeRe(field)}\\b`);
    if (!word.test(content)) continue;
    if (lgpdExcludePattern(field).test(content)) continue;
    violations.push(`  - ${field}`);
  }
  if (violations.length === 0) {
    return { ok: true };
  }
  return {
    ok: false,
    message: [
      '⚠️  ALERTA LGPD: Campos sensíveis detectados em response/controller.',
      '',
      'Os seguintes campos protegidos podem estar sendo expostos:',
      ...violations,
      '',
      'Dados de saúde e credenciais NUNCA devem ser retornados em responses.',
      'Use @Exclude(), select: false, ou omita-os do DTO de response.',
      '',
      `Arquivo: ${norm(filePath)}`,
    ].join('\n'),
  };
}

function isProdTsPath(fp) {
  const n = norm(fp);
  const isTest =
    /\.(spec|test)\.(ts|tsx)$/.test(n) ||
    n.includes('__tests__') ||
    n.includes('/tests/test_');
  return (
    (n.includes('backend/src/') || n.includes('frontend/src/')) &&
    (n.endsWith('.ts') || n.endsWith('.tsx')) &&
    !isTest
  );
}

const CONSOLE_RE = /console\.(log|warn|error|debug|info)\s*\(/;

/**
 * Espelha pre-tool-no-console-log.sh
 */
function checkNoConsole(content, filePath) {
  if (!isProdTsPath(filePath)) {
    return { ok: true };
  }
  if (!CONSOLE_RE.test(content)) {
    return { ok: true };
  }
  const n = norm(filePath);
  const isBackend = n.includes('backend/src/');
  const lines = [
    '⚠️  ALERTA: console.* detectado em código de produção.',
    '',
  ];
  if (isBackend) {
    lines.push(
      'No backend, use o NestJS Logger:',
      '  private readonly logger = new Logger(SeuService.name);',
      '  this.logger.log("mensagem");',
      '',
    );
  } else {
    lines.push(
      'No frontend, remova console.log de código de produção.',
      'Para debug temporário: if (process.env.NODE_ENV === "development") { ... }',
      '',
    );
  }
  lines.push(`Arquivo: ${n}`);
  return { ok: false, message: lines.join('\n') };
}

module.exports = {
  checkTenant,
  checkLgpd,
  checkNoConsole,
  norm,
};
