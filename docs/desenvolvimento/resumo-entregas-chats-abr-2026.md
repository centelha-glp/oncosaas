# Resumo das entregas (chats Cursor — abril/2026)

Este documento relaciona os fios de conversa (transcripts) com o escopo entregue no repositório e as pull requests correspondentes.

## PR `chore/cursor-skills-e-processos-onconav`

**Transcript principal:** `1133c4cd-c957-4f48-b057-2e4d3c0924fe` (skills, processos, regras do github-organizer).

**Conteúdo:**

- Skills canónicas em `.cursor/skills/agente-*/` e `.cursor/skills/squad-*/` com ordem de acionamento e orquestração.
- Processos em `.cursor/skills/processo-*/` (gate de commit, feature E2E, bugfix, deploy, evolução IA, mudança clínica).
- Atualização de `.cursor/agents/github-organizer.md` e `.cursor/rules/github-organizer.mdc`: fluxo obrigatório antes de commit (branch ideal, PR já mergeado no mesmo nome, nova branch a partir de `main`).
- Planos de referência em `.cursor/plans/` (dados clínicos estruturados, paridade clínica).

## PR `feat/clinical-navigation-data-parity-ux`

**Transcripts e temas:**

| Transcript | Tema no chat |
|------------|----------------|
| `ece7d8b9-ca1e-4fc9-aab5-07ed1fcab3f1` | Preenchimento de etapas de navegação com modelo padrão e específico por tipo de etapa/exame/consulta; scaffolds de evolução clínica; UX do formulário por etapa. |
| `989710ec-4169-414c-8beb-2eabaacdb945` | Auditoria de performance (React Query, Next.js, consultas backend, dashboard). |
| `25af47f9-b0c9-469f-8137-c8687fbe1ca3` | Continuação de paridade clínica / plataforma (alinhado aos planos em `.cursor/plans/`). |
| `de1cd9bd-9701-4110-81bf-db00ef076352` | Continuação até conclusão das tarefas de implementação. |

**Conteúdo técnico (visão geral):**

- **Prisma:** FK opcional de nota clínica e de resposta de questionário para `NavigationStep`; migrations dedicadas.
- **Backend:** `tenantId` e isolamento em serviços de domínio; helper de questionário vinculado à navegação; scaffolds de seções de evolução por tipo de nota e etapa; sugestões de seção com `navigationStepId` e `noteType`; ajustes em agente (decision gate, mensagens) e dashboard.
- **Frontend:** página de navegação oncológica com formulários variantes por etapa; cliente de notas clínicas; prontuário e listagem de pacientes; componentes de onboarding e retry de query; E2E de UX/a11y e onboarding; `next.config` e hooks alinhados à auditoria de performance.

## Notas

- A branch `feat/ai-rag-corpus-priorizacao` já integrou PR anterior (#73); trabalho novo foi ramificado a partir de `origin/main` com nomes novos, conforme regra do github-organizer.
