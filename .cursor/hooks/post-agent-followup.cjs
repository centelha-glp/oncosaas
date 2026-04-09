#!/usr/bin/env node
/**
 * Pós-agente: lembretes para delegar a `seguranca-compliance` e `documentation`
 * (hooks não invocam Task — só injetam follow-up / contexto).
 *
 * Modos: postToolUse | subagentStop
 *
 * Teste (cwd = raiz do repo):
 *   echo '{"subagent_type":"generalPurpose"}' | node .cursor/hooks/post-agent-followup.cjs subagentStop
 *   echo '{"tool_name":"Write","tool_input":{"path":"backend/src/x.ts"}}' | node .cursor/hooks/post-agent-followup.cjs postToolUse
 */
const fs = require('fs');

/** Visível no canal Hooks (stderr). Stdout continua sendo só JSON para o Cursor. */
function logHook(line) {
  console.error(`[OncoNav hook post-agent-followup] ${line}`);
}

/** Rules Cursor (normas); agentes em .cursor/agents/ executam revisão/atualização focada */
const RULE_SECURITY = '.cursor/rules/security.mdc';
const RULE_DOCUMENTATION = '.cursor/rules/documentation.mdc';
const AGENT_SECURITY = '.cursor/agents/seguranca-compliance.md';
const AGENT_DOCUMENTATION = '.cursor/agents/documentation.md';

function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

/**
 * Cursor às vezes envia stdin vazio, com BOM ou com ruído; evita falso "JSON inválido".
 */
function parseHookInput(raw) {
  let s = String(raw ?? '');
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  s = s.trim();
  if (s === '') return { ok: true, value: {} };

  try {
    return { ok: true, value: JSON.parse(s) };
  } catch {
    /* tenta extrair o primeiro objeto JSON */
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return { ok: true, value: JSON.parse(s.slice(start, end + 1)) };
      } catch {
        /* fallthrough */
      }
    }
    return { ok: false, value: {}, snippet: s.slice(0, 120) };
  }
}

/** Subagentes após os quais não repetimos o pacote de follow-up */
const SKIP_SUBAGENT_FOLLOWUP = new Set([
  'explore',
  'seguranca-compliance',
  'documentation',
  'readonly',
]);

function normSubagentType(input) {
  const raw =
    input.subagent_type ??
    input.subagentType ??
    input.type ??
    input.agent_type ??
    input.subagent ??
    '';
  return String(raw).toLowerCase().trim();
}

function shouldSkipSubagentFollowup(t) {
  if (!t) return false;
  if (SKIP_SUBAGENT_FOLLOWUP.has(t)) return true;
  if (t.includes('seguranca') && t.includes('compliance')) return true;
  return false;
}

function collectPathCandidates(obj, out = []) {
  if (!obj || typeof obj !== 'object') return out;
  for (const k of ['path', 'file_path', 'target_file', 'filePath', 'uri']) {
    if (typeof obj[k] === 'string' && obj[k].trim()) out.push(obj[k]);
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') collectPathCandidates(v, out);
  }
  return out;
}

function normPath(relPath) {
  return String(relPath).replace(/\\/g, '/').toLowerCase();
}

function needsBackendSecurityReview(relPath) {
  const p = normPath(relPath);
  if (!p) return false;
  if (p.startsWith('backend/') && (p.endsWith('.ts') || p.endsWith('.tsx')))
    return true;
  if (p.includes('schema.prisma')) return true;
  if (p.startsWith('backend/prisma/')) return true;
  return false;
}

/** Código alterado: pedir atualização de docs técnica (README, OpenAPI, docs/, etc.) */
function needsDocumentationFollowup(relPath) {
  const p = normPath(relPath);
  if (!p) return false;
  if (p.startsWith('backend/') && /\.(ts|tsx)$/.test(p)) return true;
  if (p.startsWith('frontend/') && /\.(ts|tsx)$/.test(p)) return true;
  if (p.startsWith('ai-service/') && p.endsWith('.py')) return true;
  if (p.includes('schema.prisma')) return true;
  return false;
}

/** Hooks, rules e deps — sem lembrete de segurança/docs (evita ruído ao editar o próprio hook). */
function isToolingOrMetaPath(relPath) {
  const p = String(relPath).replace(/\\/g, '/').toLowerCase();
  if (!p) return false;
  if (p.includes('/.cursor/') || p.startsWith('.cursor/')) return true;
  if (p.includes('/node_modules/') || p.startsWith('node_modules/'))
    return true;
  return false;
}

function handleSubagentStop(input) {
  const t = normSubagentType(input);
  if (shouldSkipSubagentFollowup(t)) {
    logHook(
      `subagentStop: sem follow-up (subagente "${t || 'desconhecido'}" está na lista de exclusão).`,
    );
    console.log('{}');
    return;
  }

  const msg = [
    '[Hook pós-agente — subagentStop] Antes de encerrar ou abrir PR:',
    '',
    '1) **Segurança**: se houve alteração em `backend/` (controllers, services, DTOs, guards, Prisma) ou fluxo auth/tenant/LGPD,',
    `   invoque **Task** com \`seguranca-compliance\` (\`${AGENT_SECURITY}\`).`,
    `   Normas de referência: \`${RULE_SECURITY}\` (inclua no contexto com @ ou leitura direta).`,
    '   Se não houve mudança sensível, indique que não se aplica.',
    '',
    '2) **Documentação**: se a mudança altera contrato de API, fluxos, integrações ou comportamento de produto,',
    `   invoque **Task** com \`documentation\` (\`${AGENT_DOCUMENTATION}\`) para atualizar README, OpenAPI/Swagger,`,
    '   guias em `docs/` ou JSDoc/docstrings conforme o caso.',
    `   Normas de referência: \`${RULE_DOCUMENTATION}\`.`,
    '   Se a alteração foi só interna sem impacto documentável, indique que não se aplica.',
  ].join('\n');

  logHook(
    `subagentStop: enviando followup_message (subagente "${t || '?'}"). Revise segurança + documentação.`,
  );
  console.log(JSON.stringify({ followup_message: msg }));
}

function handlePostToolUse(input) {
  const tool =
    input.tool_name ??
    input.toolName ??
    input.name ??
    input.tool ??
    '';
  const name = String(tool);

  const writeLike =
    /write|strreplace|search_replace|apply_patch|edit/i.test(name) ||
    /Write|StrReplace/i.test(name);

  if (!writeLike) {
    logHook(
      `postToolUse: ignorado (ferramenta "${name}" não é escrita; stdout {}).`,
    );
    console.log('{}');
    return;
  }

  const ti = input.tool_input ?? input.toolInput ?? input.input ?? {};
  const paths = collectPathCandidates(ti);
  if (paths.length === 0) {
    logHook(
      'postToolUse: nenhum path em tool_input — não há lembrete (stdout {}).',
    );
    console.log('{}');
    return;
  }
  const rel =
    paths.find(
      (p) =>
        needsBackendSecurityReview(p) || needsDocumentationFollowup(p),
    ) ?? paths[0];

  if (isToolingOrMetaPath(rel)) {
    console.log('{}');
    return;
  }

  const parts = [];
  if (needsBackendSecurityReview(rel)) {
    parts.push(
      `[Segurança] ${rel}: subagente \`seguranca-compliance\` (${AGENT_SECURITY}); normas \`${RULE_SECURITY}\`.`,
    );
  }
  if (needsDocumentationFollowup(rel)) {
    parts.push(
      `[Documentação] ${rel}: subagente \`documentation\` (${AGENT_DOCUMENTATION}); normas \`${RULE_DOCUMENTATION}\`.`,
    );
  }

  if (parts.length === 0) {
    logHook(
      `postToolUse: arquivo "${rel}" fora do escopo segurança/docs — stdout {}.`,
    );
    console.log('{}');
    return;
  }

  const additional_context = `[Hook pós-agente — postToolUse] ${parts.join(' ')}`;

  logHook(
    `postToolUse: enviando additional_context para "${rel}" (segurança/documentação).`,
  );
  console.log(JSON.stringify({ additional_context }));
}

function main() {
  const mode = process.argv[2] || '';
  const raw = readStdinSync();
  const parsed = parseHookInput(raw);
  const input = parsed.ok ? parsed.value : {};
  if (!parsed.ok) {
    logHook(
      `stdin não é JSON válido (trecho: ${JSON.stringify(parsed.snippet)}). stdout {}.`,
    );
    console.log('{}');
    return;
  }

  if (mode === 'subagentStop' || mode.includes('subagent')) {
    handleSubagentStop(input);
    return;
  }
  if (mode === 'postToolUse' || mode.includes('post-tool')) {
    handlePostToolUse(input);
    return;
  }

  console.error('post-agent-followup: modo desconhecido:', mode);
  console.log('{}');
}

try {
  main();
} catch (err) {
  console.error(err);
  console.log('{}');
}
