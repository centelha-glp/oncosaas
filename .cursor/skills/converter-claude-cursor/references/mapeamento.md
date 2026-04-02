# Mapeamento Claude Code → Cursor

## CLAUDE.md → AGENTS.md (ou regra)

- **Destino típico**: `AGENTS.md` na raiz do repositório (instruções de projeto para o agente no Cursor).
- **Alternativa**: fatiar seções em `.cursor/rules/<tema>.mdc` com `alwaysApply: true` ou `globs` adequados, se o usuário preferir regras modulares em vez de um único arquivo.

### Ajustes de conteúdo

- Manter estrutura de seções; atualizar apenas referências explícitas a “Claude Code” para “Cursor” quando forem instruções ao desenvolvedor/agente.
- Tabelas de URLs e comandos do projeto: copiar literalmente se ainda válidas.

## `.claude/rules/*.md` → `.cursor/rules/*.mdc`

### Frontmatter

Cursor usa YAML no topo do `.mdc`:

```yaml
---
description: <texto curto; obrigatório para descoberta>
alwaysApply: false
globs:
  - "backend/**/*.ts"
  - "frontend/**/*.tsx"
---
```

- Se a regra Claude não tiver equivalente: gerar `description` a partir do primeiro parágrafo ou do título.
- `alwaysApply: true` quando a regra for global ao projeto (equivalente a “sempre aplicar”).
- `globs`: preencher se a regra Claude indicar escopo por pasta/padrão; senão omitir ou `alwaysApply: true`.
- **Vários padrões**: usar **lista YAML** (`globs:` com `- "..."` por linha). Evitar string única com vírgulas, chaves `{a,b}` ou extensões `*.{ts,tsx}` em um só token — o Cursor/minimatch pode ignorar o restante silenciosamente. Para `ts` e `tsx`, listar `**/*.ts` e `**/*.tsx` separadamente.

### Corpo

- Colar o markdown após o frontmatter; remover duplicação de título se o arquivo Claude começar com `#` redundante com o nome do arquivo.

## `.claude/skills/*/SKILL.md` → `.cursor/skills/*/SKILL.md`

### Frontmatter

Cursor exige:

```yaml
---
name: nome-da-skill
description: <até ~1024 chars; incluir O QUÊ e QUANDO usar>
---
```

- **name**: normalmente igual ao nome da pasta; minúsculas, hífens, ≤64 caracteres.
- **description**: terceira pessoa; incluir gatilhos (“Use quando…”).

### Diferenças comuns no ecossistema Claude

- Skills do Codex podem ter metadados extras (`agents/openai.yaml`); no Cursor não são obrigatórios — não copiar salvo pedido explícito.
- Pastas `scripts/`, `references/`, `assets/`: copiar como estão para a nova skill em `.cursor/skills/<nome>/`.

## `.claude/agents/*.md` → `.cursor/agents/*.md`

### Frontmatter

A UI do Cursor preenche o campo **Description** a partir do YAML `description:` no topo do arquivo. **Não** mover o texto de `description` para o corpo como blockquote `> **Quando usar:**` — isso deixa o metadata vazio e quebra a descoberta do subagente.

- Copiar o **primeiro** bloco `---` … `---` da origem com:
  - `name:` (identificador do agente)
  - `description:` (texto integral do campo homônimo no Claude)
  - `tools:` (opcional; manter se existir na origem)
- **Corpo**: todo o Markdown **depois** do fechamento do frontmatter, sem prefixo `# Subagent:` nem citação “Quando usar” duplicando o `description`.
- Ajustes de texto: trocar menções “Claude Code” por “Cursor” onde for instrução ao agente, como nas skills.

### Corpo

- Preservar o conteúdo após o frontmatter (títulos, tabelas, exemplos de código com `---` dentro do markdown são válidos).

## Nomenclatura de arquivos

- **Colisão no destino**: sobrescrever `.cursor/rules/<nome>.mdc` / `.cursor/skills/<nome>/**` quando já existirem, desde que o mapeamento origem→destino seja o mesmo.
- Preferir extensão **.mdc** para regras do Cursor.

## O que não fazer

- Alterar `.claude/**` ou `CLAUDE.md` durante a conversão.
- Apagar arquivos em `.cursor/` que não tenham origem correspondente na conversão atual (não fazer “limpeza” agressiva salvo pedido explícito).
