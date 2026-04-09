#!/usr/bin/env node
/**
 * Cursor Agent hooks — stdin JSON por evento (docs Cursor Hooks).
 * Paridade com .claude/hooks/*.sh:
 *
 * | Claude (PreTool/PostTool)     | Cursor                          |
 * |------------------------------|---------------------------------|
 * | pre-tool-require-tests.sh    | beforeShellExecution (git)      |
 * | (lembrete GitHub)            | beforeShellExecution (push/gh…) |
 * | post-tool-prisma-validate.sh | afterFileEdit (schema.prisma)   |
 * | pre-tool-tenant-check.sh     | afterFileEdit (.service/controller) |
 * | pre-tool-lgpd-check.sh       | afterFileEdit (DTO response / controller) |
 * | pre-tool-no-console-log.sh   | afterFileEdit (backend/frontend src) |
 * | pre-tool-load-claude-md.sh   | beforeReadFile (dica 1x/subdir → stderr) |
 * | session-start.sh             | só Claude Code remoto — não aplica |
 *
 * Teste (cwd = raiz do repo):
 *   echo '{"command":"..."}' | node .cursor/hooks/cursor-hook-runner.cjs beforeShellExecution
 */
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const checks = require(path.join(__dirname, 'cursor-hook-checks.cjs'));

const RULE_GITHUB_ORGANIZER = '.cursor/rules/github-organizer.mdc';
const AGENT_GITHUB_ORGANIZER = '.cursor/agents/github-organizer.md';

/** Comandos que alteram remoto/PR/histórico: pedir confirmação e lembrar github-organizer + rule */
function isSensitiveGitOrGh(command) {
  const c = String(command || '').trim();
  if (!c) return false;

  if (/^\s*gh\s+(version|--version|help|-h|--help)\b/i.test(c)) return false;
  if (/^\s*gh\s+auth\s+(status|login|logout|refresh-token)\b/i.test(c))
    return false;

  if (/^\s*gh\s/i.test(c)) {
    if (
      /^\s*gh\s+(pr\s+list|pr\s+view|pr\s+status|issue\s+list|run\s+list|status|search)\b/i.test(
        c,
      )
    ) {
      return false;
    }
    return true;
  }

  if (!/\bgit\s/i.test(c)) return false;

  if (/\bgit\s+commit\b/i.test(c)) return false;

  if (
    /\bgit\s+(push|pull|merge|rebase|cherry-pick|clone|submodule)\b/i.test(c)
  ) {
    return true;
  }
  if (/\bgit\s+reset\b/i.test(c)) return true;
  if (/\bgit\s+tag\b.*\b(push|delete)\b/i.test(c)) return true;

  return false;
}

function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function workspaceRoot(input) {
  const roots = input.workspace_roots;
  if (Array.isArray(roots) && roots[0]) {
    let r = String(roots[0]);
    if (/^\/[a-zA-Z]:\//.test(r)) {
      r = r.replace(/^\/([a-zA-Z]):\//, '$1:/');
    }
    return r;
  }
  return process.cwd();
}

function resolveEditedFilePath(input) {
  const root = workspaceRoot(input);
  let fp = String(input.file_path || input.path || '').trim();
  if (!fp) return null;
  fp = fp.replace(/\\/g, '/');
  if (/^\/[a-zA-Z]:\//.test(fp)) {
    fp = fp.replace(/^\/([a-zA-Z]):\//, '$1:/');
  }
  if (path.isAbsolute(fp)) {
    return fp;
  }
  return path.join(root, fp);
}

/** Espelha pre-tool-load-claude-md.sh — Cursor não tem additionalContext; avisa 1x por subdir. */
function handleBeforeRead(input) {
  const root = workspaceRoot(input);
  const raw = String(
    input.file_path || input.path || input.uri || '',
  ).replace(/\\/g, '/');

  let subdir = '';
  if (/(^|\/)(backend)(\/|$)/i.test(raw)) subdir = 'backend';
  else if (/(^|\/)(frontend)(\/|$)/i.test(raw)) subdir = 'frontend';
  else if (/(^|\/)(ai-service)(\/|$)/i.test(raw)) subdir = 'ai-service';

  if (subdir) {
    const markerPath = path.join(root, '.cursor', '.hook-claude-md-hints.json');
    let hints = {};
    try {
      if (fs.existsSync(markerPath)) {
        hints = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
      }
    } catch {
      hints = {};
    }
    if (!hints[subdir]) {
      hints[subdir] = true;
      try {
        fs.mkdirSync(path.dirname(markerPath), { recursive: true });
        fs.writeFileSync(markerPath, JSON.stringify(hints, null, 2), 'utf8');
      } catch {
        /* ignore */
      }
      const rel = path.join(subdir, '.claude', 'CLAUDE.md');
      const full = path.join(root, rel);
      if (fs.existsSync(full)) {
        console.error(
          `[OncoNav hooks] Convenções ${subdir}: leia ${rel.replace(/\\/g, '/')} (no Claude Code este bloco era auto-injetado).`,
        );
      }
    }
  }

  console.log(JSON.stringify({ permission: 'allow' }));
}

/** Espelha .claude/hooks/pre-tool-require-tests.sh (Bash + git commit) */
function handleBeforeShell(input) {
  const root = workspaceRoot(input);
  const command = String(input.command || '');

  const allow = () => {
    console.log(JSON.stringify({ permission: 'allow' }));
  };
  /** Orientação (sem bloquear): lembrar Task + rule do github-organizer. @param {{ forCommit?: boolean }} [opts] */
  const allowWithGithubOrganizerHint = (opts = {}) => {
    const forCommit = opts.forCommit === true;
    const agentMsg = [
      'Antes de commitar, dar push ou trabalhar em PR, use Task `github-organizer`',
      `(\`${AGENT_GITHUB_ORGANIZER}\`) e a rule \`${RULE_GITHUB_ORGANIZER}\` quando aplicável.`,
    ].join(' ');
    const userMsg = forCommit
      ? `Lembrete: antes de concluir este commit, alinhe com Task \`github-organizer\` e \`${RULE_GITHUB_ORGANIZER}\` (commits/PR no GitHub).`
      : `Lembrete: antes de push ou de comandos gh que alterem PR/remoto, alinhe com Task \`github-organizer\` e \`${RULE_GITHUB_ORGANIZER}\`.`;
    console.log(
      JSON.stringify({
        permission: 'allow',
        user_message: userMsg,
        userMessage: userMsg,
        agent_message: agentMsg,
        agentMessage: agentMsg,
      }),
    );
    console.error(
      '[OncoNav hook beforeShellExecution] lembrete github-organizer (allow):\n',
      userMsg,
    );
  };
  const deny = (agentMessage) => {
    console.log(
      JSON.stringify({
        permission: 'deny',
        agentMessage,
      }),
    );
    console.error(
      '[OncoNav hook beforeShellExecution] commit bloqueado (deny). Veja agentMessage no JSON.',
    );
  };

  if (isSensitiveGitOrGh(command)) {
    allowWithGithubOrganizerHint();
    return;
  }

  if (!/git commit/.test(command)) {
    allow();
    return;
  }
  if (/git commit --allow-empty|COMMIT_EDITMSG/.test(command)) {
    allowWithGithubOrganizerHint({ forCommit: true });
    return;
  }

  let staged = '';
  try {
    staged = execSync('git diff --cached --name-only', {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    allowWithGithubOrganizerHint({ forCommit: true });
    return;
  }

  const lines = staged
    .split(/\r?\n/)
    .map((s) => s.trim().replace(/\\/g, '/'))
    .filter(Boolean);

  if (lines.length === 0) {
    allowWithGithubOrganizerHint({ forCommit: true });
    return;
  }

  const prodBackend = lines.filter(
    (f) =>
      /^backend\/src\/.*\.ts$/.test(f) &&
      !/\.spec\.ts$/.test(f),
  );
  const prodFrontend = lines.filter((f) => {
    if (!/^frontend\/src\/.*\.(ts|tsx)$/.test(f)) return false;
    if (/\.(test|spec)\.(ts|tsx)$/.test(f)) return false;
    if (f.includes('__tests__')) return false;
    return true;
  });
  const prodAi = lines.filter((f) => /^ai-service\/src\/.*\.py$/.test(f));

  const hasProd = [...prodBackend, ...prodFrontend, ...prodAi];
  if (hasProd.length === 0) {
    allowWithGithubOrganizerHint({ forCommit: true });
    return;
  }

  const testFiles = lines.filter(
    (f) =>
      /\.(spec|test)\.(ts|tsx)$/.test(f) ||
      f.includes('__tests__') ||
      f.includes('/tests/test_'),
  );

  if (testFiles.length > 0) {
    allowWithGithubOrganizerHint({ forCommit: true });
    return;
  }

  deny(
    [
      '🚫 COMMIT BLOQUEADO: código de produção sem testes correspondentes no stage.',
      '',
      'Arquivos de produção detectados:',
      ...hasProd.map((f) => `  - ${f}`),
      '',
      'Execute o agente test-generator antes de commitar (ex.: skill gerar-testes / test-generator).',
      'Inclua os arquivos de teste no stage e tente novamente.',
    ].join('\n'),
  );
}

function failAfterEdit(msg) {
  console.error(msg);
  process.exit(1);
}

/** Post-Prisma + pre-tool-tenant, lgpd, console (arquivo já salvo no disco). */
function handleAfterFileEdit(input) {
  const filePath = resolveEditedFilePath(input);
  if (!filePath || !fs.existsSync(filePath)) {
    process.exit(0);
    return;
  }

  const rel = checks.norm(filePath);
  const lower = filePath.toLowerCase();

  if (lower.includes('schema.prisma')) {
    const root = workspaceRoot(input);
    const backendDir = path.join(root, 'backend');
    if (!fs.existsSync(backendDir)) {
      process.exit(0);
      return;
    }

    const run = (args) =>
      spawnSync('npx', args, {
        cwd: backendDir,
        encoding: 'utf8',
        shell: process.platform === 'win32',
        maxBuffer: 10 * 1024 * 1024,
      });

    console.error('🔍 Validando schema Prisma (hook afterFileEdit)...');
    const v = run(['prisma', 'validate']);
    if (v.stdout) console.error(v.stdout);
    if (v.stderr) console.error(v.stderr);
    if (v.status !== 0) {
      console.error('❌ Schema Prisma inválido. Corrija antes de continuar.');
      process.exit(1);
    }

    console.error('📐 Formatando schema Prisma...');
    run(['prisma', 'format']);
    console.error('✅ Schema Prisma válido.');
    process.exit(0);
    return;
  }

  const textExts = ['.ts', '.tsx', '.py'];
  if (!textExts.some((e) => lower.endsWith(e))) {
    process.exit(0);
    return;
  }

  let content = '';
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    process.exit(0);
    return;
  }

  const t = checks.checkTenant(content, rel);
  if (!t.ok) failAfterEdit(t.message);

  const l = checks.checkLgpd(content, rel);
  if (!l.ok) failAfterEdit(l.message);

  const c = checks.checkNoConsole(content, rel);
  if (!c.ok) failAfterEdit(c.message);

  process.exit(0);
}

function main() {
  const mode = process.argv[2] || '';
  const raw = readStdinSync();
  let input = {};
  try {
    input = raw ? JSON.parse(raw) : {};
  } catch {
    if (mode.includes('Shell') || mode === 'beforeShellExecution') {
      console.log(JSON.stringify({ permission: 'allow' }));
    } else if (mode.includes('Read') || mode === 'beforeReadFile') {
      console.log(JSON.stringify({ permission: 'allow' }));
    }
    process.exit(0);
    return;
  }

  if (
    mode === 'beforeShellExecution' ||
    mode.includes('adapter-shell') ||
    mode === 'shell'
  ) {
    handleBeforeShell(input);
    return;
  }

  if (mode === 'beforeReadFile' || mode.includes('before-read')) {
    handleBeforeRead(input);
    return;
  }

  if (mode === 'afterFileEdit' || mode.includes('after-file-edit')) {
    handleAfterFileEdit(input);
    return;
  }

  console.error('cursor-hook-runner: modo desconhecido:', mode);
  process.exit(0);
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exit(0);
}
