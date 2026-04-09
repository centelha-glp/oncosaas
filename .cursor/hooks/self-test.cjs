#!/usr/bin/env node
/**
 * Testa os hooks sem pipe no shell (evita "stdin is not a tty" no Git Bash do Windows).
 *
 * Uso (na raiz do repo):
 *   node .cursor/hooks/self-test.cjs
 *
 * Nota Git Bash: `echo ... | node` ou `node ... < arquivo` pode ainda imprimir
 * "stdin is not a tty" (interação MSYS + node.exe); em geral o JSON segue correto
 * no stdout. Para evitar o aviso, use este script ou PowerShell/cmd.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const dir = __dirname;
const node = process.execPath;

function run(label, script, args, stdin) {
  const r = spawnSync(node, [path.join(dir, script), ...args], {
    input: stdin == null ? undefined : String(stdin),
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  console.log(`\n--- ${label} ---`);
  if (r.stdout) process.stdout.write(r.stdout);
  if (!r.stdout) console.log('(stdout vazio)');
  if (r.stderr) process.stderr.write(r.stderr);
  console.log(`[exit ${r.status ?? '?'}]`);
  if (r.error) console.error(r.error);
}

console.log('OncoNav — teste de hooks (stdin via spawn, sem pipe no bash)\n');

run(
  'post-agent-followup subagentStop (generalPurpose)',
  'post-agent-followup.cjs',
  ['subagentStop'],
  '{"subagent_type":"generalPurpose"}\n',
);

run(
  'post-agent-followup postToolUse (backend)',
  'post-agent-followup.cjs',
  ['postToolUse'],
  JSON.stringify({
    tool_name: 'Write',
    tool_input: { path: 'backend/src/x.ts' },
  }) + '\n',
);

run(
  'cursor-hook-runner beforeShellExecution (git push)',
  'cursor-hook-runner.cjs',
  ['beforeShellExecution'],
  '{"command":"git push"}\n',
);

run(
  'cursor-hook-runner beforeShellExecution (git commit)',
  'cursor-hook-runner.cjs',
  ['beforeShellExecution'],
  '{"command":"git commit -m test"}\n',
);

run(
  'cursor-hook-runner beforeReadFile',
  'cursor-hook-runner.cjs',
  ['beforeReadFile'],
  '{"file_path":"backend/src/foo.ts"}\n',
);

console.log('\nFim. Se viu JSON em stdout e exit 0, os hooks respondem corretamente.\n');
