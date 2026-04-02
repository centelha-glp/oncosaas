---
name: converter-claude-cursor
description: Converte configuração e documentação do ecossistema Claude Code (CLAUDE.md, .claude/rules, .claude/skills) para equivalentes do Cursor (AGENTS.md, .cursor/rules, .cursor/skills), podendo sobrescrever destinos em .cursor/ e AGENTS.md; não altera originais em .claude/ nem CLAUDE.md. Use quando o usuário pedir migração Claude→Cursor, espelhar regras/skills no Cursor, ou “converter arquivos claude para cursor”.
---

# Converter Claude Code → Cursor

## Regra absoluta (origem)

- **Não editar, mover, renomear nem apagar** nada em `.claude/` nem `CLAUDE.md` (nem variantes como `CLAUDE.local.md`).
- **Saída** em `.cursor/`, `AGENTS.md` na raiz (e caminhos equivalentes): **pode sobrescrever** arquivos já existentes no destino para refletir a conversão atual.

Se o usuário pedir remoção ou edição na origem, recusar; a sincronização é só no lado Cursor.

## O que mapeia para o quê

| Origem (leitura) | Destino (escrita) |
|------------------|-------------------|
| `CLAUDE.md` | `AGENTS.md` na raiz **ou** trechos consolidados em `.cursor/rules/` (preferir um único `projeto.mdc` se o usuário quiser só regras) |
| `.claude/rules/*.md` | `.cursor/rules/<nome>.mdc` |
| `.claude/skills/<skill>/SKILL.md` | `.cursor/skills/<skill>/SKILL.md` (criar pasta ou sobrescrever) |
| `.claude/agents/*.md` | `.cursor/agents/*.md` com **frontmatter** `name` + `description` (não usar blockquote “Quando usar” no lugar do YAML) |

Detalhes de frontmatter, nomes e opções: [references/mapeamento.md](references/mapeamento.md).

## Fluxo de trabalho

1. **Inventariar**: listar `CLAUDE.md`, `.claude/rules/`, `.claude/skills/*/SKILL.md`, `.claude/agents/*.md` se a migração incluir subagentes (somente leitura).
2. **Planejar destinos**: mapear nomes finais em `.cursor/` e `AGENTS.md`; **sobrescrever** se o arquivo de destino já existir (padrão).
3. **Converter conteúdo**:
   - Copiar o corpo Markdown com ajustes mínimos (trocar menções “Claude Code” por “Cursor” onde for instrução ao agente, sem reescrever domínio do projeto).
   - Aplicar transformações de metadados conforme `references/mapeamento.md`.
4. **Escrever** nos caminhos de destino (criar ou sobrescrever).
5. **Resumir**: listar arquivos criados ou atualizados e o que foi mapeado; lembrar que a origem permanece intacta.

## Skills aninhadas

- Se `.claude/skills/<nome>/` tiver `scripts/`, `references/`, `assets/`, copiar a árvore para `.cursor/skills/<nome>/`, preservando estrutura; sobrescrever arquivos homônimos no destino.
- Não copiar `agents/openai.yaml` a menos que o usuário precise de paridade com ferramentas que consumam isso; o Cursor usa sobretudo `SKILL.md`.

## Checklist de qualidade

- [ ] Nenhuma gravação em `.claude/` nem em `CLAUDE.md`.
- [ ] Frontmatter Cursor válido (`name` + `description` em skills e em **agentes** `.cursor/agents/*.md`; regras `.mdc` com `description` e opcionalmente `globs` / `alwaysApply`).
- [ ] Nomes de skill: minúsculas, hífens, ≤64 caracteres.
- [ ] Destinos em `.cursor/` e `AGENTS.md` atualizados conforme conversão (sobrescrita permitida).
