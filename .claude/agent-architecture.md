# ONCONAV — Arquitetura de Agentes e Squads

Referência técnica do sistema de agentes Claude Code do ONCONAV: 19 agentes especializados, organizados em 6 squads, governados por 18 rule files e orquestrados por skills.

---

## Visão Geral

O sistema de agentes do ONCONAV automatiza a engenharia da plataforma SaaS oncológica, garantindo que cada área do código seja tratada por especialistas com contexto e regras adequadas. Os agentes não são genéricos — cada um carrega as constraints do seu domínio e opera dentro de fluxos de trabalho definidos que preservam invariantes críticos, especialmente de segurança clínica.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Squad Produto          Squad Clínico          Squad IA/Dados       │
│  product-owner          clinical-domain         ai-service          │
│  architect         ──►  fhir-integration   ──►  data-scientist      │
│  documentation          whatsapp-integr.        llm-agent-arch.     │
│                                                 llm-context-eng.    │
│                                                 rag-engineer        │
│                              │                                      │
│                              ▼                                      │
│  Squad Plataforma                              Squad Infra/Cloud    │
│  backend-nestjs                                devops               │
│  frontend-nextjs        ◄──────────────────►   aws                  │
│  database-engineer                             terraform            │
│  ux-accessibility                                                   │
│                                                                     │
│  ════════════════════════════════════════════════════════════════   │
│  Squad Qualidade  (transversal — toda alteração passa por aqui)     │
│  test-generator  →  seguranca-compliance  →  github-organizer       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Squads: Responsabilidades e Rules

### Squad Produto
> Visão estratégica, arquitetura e documentação

| Agente | Responsabilidade | Rule associada |
|--------|-----------------|----------------|
| `product-owner` | Backlog, milestones, issues no GitHub | `rules/product-owner.md` |
| `architect` | Decisões cross-layer, consistência arquitetural | `rules/architect.md` |
| `documentation` | OpenAPI/Swagger, guias técnicos, docs CEP/EBSERH | `rules/documentation.md` |

**Skill:** `/po` — aciona `product-owner` para gestão de backlog

---

### Squad Clínico
> Domínio oncológico e integrações de saúde

| Agente | Responsabilidade | Rule associada |
|--------|-----------------|----------------|
| `clinical-domain` | Protocolos, regras de triagem, terminologia clínica | `rules/clinical-domain.md` |
| `fhir-integration` | HL7/FHIR R4, recursos FHIR, interoperabilidade HIS/PEP | `rules/fhir-integration.md` |
| `whatsapp-integration` | WhatsApp Business API, webhook, opt-in, templates | `rules/whatsapp-integration.md` |

**Skill:** `/novo-protocolo-clinico` — cria protocolo oncológico com validação clínica

**Invariante crítica:** qualquer alteração em `clinical_rules.py`, `clinical_scores.py`, `symptom_analyzer.py` ou templates de protocolo **exige revisão do `clinical-domain` antes do commit**.

---

### Squad Plataforma
> Engenharia core da aplicação

| Agente | Responsabilidade | Rule associada |
|--------|-----------------|----------------|
| `backend-nestjs` | NestJS, Prisma, módulos, controllers, services, testes Jest | `rules/backend.md` |
| `frontend-nextjs` | Next.js, React, componentes, hooks React Query, Zustand | `rules/frontend.md` |
| `database-engineer` | Schema Prisma, migrations, queries, índices, performance | `rules/database.md` |
| `ux-accessibility` | WCAG 2.1 AA, UX para profissionais de saúde sob pressão | `rules/ux-accessibility.md` |

**Skills:**
- `/novo-modulo-backend` — cria estrutura completa de módulo NestJS
- `/migrar-prisma` — cria e aplica migrations Prisma
- `/testar-modulo` — executa testes de módulo específico

---

### Squad IA/Dados
> Inteligência artificial, modelos clínicos e ciência de dados

| Agente | Responsabilidade | Rule associada |
|--------|-----------------|----------------|
| `ai-service` | FastAPI, agente conversacional, pipeline de triage | `rules/ai-service.md` |
| `data-scientist` | LightGBM ordinal (5 classes), 32 features, MASCC/CISNE, bias | `rules/ai-service.md` |
| `llm-agent-architect` | Arquitetura de orchestrator, subagentes, agentic loops, tool use | `rules/llm-agent-architect.md` |
| `llm-context-engineer` | Prompts, context_builder, janela de contexto, prompt caching | `rules/llm-context-engineer.md` |
| `rag-engineer` | Corpus oncológico, FAISS, embeddings, qualidade de retrieval | `rules/rag-engineer.md` |

**Skill:** `/novo-protocolo-clinico` (compartilhada com Squad Clínico ao implementar no ai-service)

---

### Squad Infra/Cloud
> Infraestrutura, cloud e operações

| Agente | Responsabilidade | Rule associada |
|--------|-----------------|----------------|
| `devops` | Docker, docker-compose, GitHub Actions, CI/CD | `rules/devops.md` |
| `aws` | ECS Fargate, RDS, ElastiCache, VPC, IAM, CloudWatch, ECR | `rules/aws.md` |
| `terraform` | IaC, módulos Terraform, state S3+DynamoDB, workspaces | `rules/terraform.md` |

---

### Squad Qualidade *(transversal)*
> Qualidade, segurança e entrega — obrigatório em toda alteração

| Agente | Responsabilidade | Rule associada |
|--------|-----------------|----------------|
| `seguranca-compliance` | LGPD/HIPAA, multi-tenancy, criptografia, audit trail | `rules/security.md` |
| `test-generator` | Testes unitários e E2E para arquivos modificados | `rules/test-generator.md` |
| `performance` | Bundle size, N+1 Prisma, Redis cache, Core Web Vitals | `rules/performance.md` |
| `github-organizer` | Commits atômicos (Conventional Commits), PRs estruturadas | `rules/github-organizer.md` |
| `code-simplifier` | Simplificação de código recém-modificado (clareza, sem mudança de comportamento) | `rules/code-simplifier.md` |

**Skills:** `/gerar-testes` — gera testes antes do commit

---

## Fluxo Pré-Commit (Invariante)

**Toda alteração de código deve seguir esta sequência obrigatória:**

```
código alterado
    │
    ▼
test-generator          ← gera/atualiza testes unitários e E2E
    │
    ▼ (somente se backend)
seguranca-compliance    ← revisa isolamento multi-tenant, LGPD/HIPAA, OWASP
    │
    ▼
github-organizer        ← organiza commits atômicos e abre PR
```

Nunca commitar diretamente. Nunca pular `seguranca-compliance` ao modificar controllers, services ou DTOs no backend.

**Fluxo pré-commit para ai-service (regras clínicas e orchestrator):**

```
arquivo ai-service modificado
    │
    ▼
test-generator          ← gera/atualiza testes pytest
    │
    ▼ (se clinical_rules.py / clinical_scores.py / symptom_analyzer.py)
clinical-domain         ← valida limiares clínicos e lógica determinística
    │
    ▼
seguranca-compliance    ← verifica tenant_id no Python, dados sensíveis, audit
    │
    ▼
github-organizer        ← organiza commits atômicos e abre PR
```

---

## Fluxos de Trabalho por Tipo de Tarefa

### 1. Nova feature end-to-end

```
architect
  → define contrato de API e interface entre camadas
      │
      ▼ (em paralelo)
backend-nestjs + frontend-nextjs + database-engineer
  → implementam cada camada respeitando suas rules
      │
      ▼
Squad Qualidade: test-generator → seguranca-compliance → github-organizer
```

**Rules ativas:** `backend.md` · `frontend.md` · `database.md` · `security.md`

---

### 2. Feature com lógica clínica

```
clinical-domain
  → valida limiares clínicos (38°C, SpO2 92%, dor 9/10)
  → aprova nova regra determinística ou protocolo
      │
      ▼
ai-service
  → implementa em clinical_rules.py (ou clinical_scores.py)
      │
      ▼
backend-nestjs
  → expõe endpoint (ex: POST /risk/predict)
      │
      ▼
Squad Qualidade: test-generator → seguranca-compliance → github-organizer
```

**Rules ativas:** `clinical-domain.md` · `ai-service.md` · `backend.md` · `security.md`

---

### 3. Deploy em produção

```
terraform + aws
  → planejam e provisionam infraestrutura (ECS, RDS, ElastiCache, VPC)
      │
      ▼
devops
  → executa CI/CD via GitHub Actions
  → build ARM64, scan Trivy, deploy na EC2
```

**Rules ativas:** `devops.md`

---

### 4. Pesquisa CEP/EBSERH

```
clinical-domain
  → terminologia oncológica, critérios de inclusão/exclusão
      │
      ▼
documentation
  → redigir documentos para Plataforma Brasil e Rede EBSERH
      │
      ▼
data-scientist
  → metodologia ML, justificativa dos scores clínicos, análise de bias
```

---

## Invariante Clínica do Pipeline

O maior diferencial de design é a **ordem imutável dos steps no ai-service**:

```
Questionnaire fast-path (se ativo)
    │
    ▼
Intent classification
  ├─► EMERGENCY   → _build_emergency_response()   [encerra]
  ├─► GREETING    → _build_greeting_response()    [encerra]
  └─► continua...
    │
    ▼
Symptom analysis
    │
    ▼
Layer 1 — Clinical Rules  ← STEP 2.5: NUNCA MOVER DAQUI
  Regras determinísticas R01–R23
  ER_IMMEDIATE gerado aqui NÃO pode ser rebaixado por nenhum step posterior
    │
    ▼
Protocol evaluation
    │
    ▼
RAG context build
    │
    ▼
LLM pipeline (multi-agent)   ← só pode sugerir, nunca sobrescrever ER_IMMEDIATE
    │
    ▼
Action compilation
```

**Por que isso importa:** um modelo LLM ou ML que produza uma disposição mais baixa não pode comprometer a segurança de um paciente com neutropenia febril ou hipoxemia. As regras hard existem para eliminar essa classe de erro. Os agentes `clinical-domain`, `ai-service`, `llm-agent-architect` e `seguranca-compliance` compartilham essa invariante pelas suas respectivas rules.

---

## Mapa Rules → Agentes → Principais Restrições

| Rule file | Governa | Top 3 restrições |
|-----------|---------|-----------------|
| `rules/backend.md` | `backend-nestjs` | (1) Guard stack obrigatório em todo controller; (2) `tenantId` em toda query Prisma; (3) `ParseUUIDPipe` em todo `:id` |
| `rules/frontend.md` | `frontend-nextjs` | (1) API client → hooks → components, nunca pular camadas; (2) nunca `console.log`; (3) `"use client"` apenas onde necessário |
| `rules/database.md` | `database-engineer` | (1) `tenantId` obrigatório em models de paciente; (2) nunca editar migration já aplicada; (3) arrays aninhados sempre com `take` |
| `rules/security.md` | `seguranca-compliance` | (1) nunca aceitar `tenantId` do cliente; (2) `cpf`/`phone` sempre criptografados; (3) audit log nunca deletado |
| `rules/ai-service.md` | `ai-service` · `data-scientist` | (1) `clinical_rules` sempre step 2.5; (2) `ER_IMMEDIATE` nunca rebaixado; (3) nunca `print()`, sempre `logging` |
| `rules/llm-agent-architect.md` | `llm-agent-architect` | (1) `MAX_SUBAGENT_ITERATIONS ≤ 6`; (2) subagentes nunca executam tool calls; (3) nunca criar fast-path para intents com conteúdo clínico urgente |
| `rules/llm-context-engineer.md` | `llm-context-engineer` | (1) seções do system prompt em ordem fixa; (2) nunca cachear partes dinâmicas; (3) omitir navegação quando `symptom_topic_active` |
| `rules/rag-engineer.md` | `rag-engineer` | (1) `cancer_types` sempre em MAIÚSCULAS no corpus; (2) `_SCORE_THRESHOLD` nunca < 0.20; (3) IndexFlatIP, nunca IndexFlatL2 |
| `rules/clinical-domain.md` | `clinical-domain` | (1) 38°C e SpO2 92% são imutáveis; (2) CISNE só para tumores sólidos; (3) novos protocolos inativos em produção até revisão |
| `rules/devops.md` | `devops` | (1) portas sempre em `127.0.0.1`; (2) imagens ARM64 para EC2 Graviton; (3) entrypoint nunca pula migrations Prisma |
| `rules/aws.md` | `aws` | (1) região `sa-east-1` obrigatória (LGPD); (2) nunca `:latest` em produção; (3) nunca abrir port 5432 publicamente |
| `rules/terraform.md` | `terraform` | (1) versões fixas de providers; (2) nunca commitar `.tfstate`; (3) `prevent_destroy` em recursos com dados |
| `rules/whatsapp-integration.md` | `whatsapp-integration` | (1) validar assinatura HMAC em produção; (2) webhook responde 200 imediato + `setImmediate()`; (3) token nunca em texto claro |
| `rules/fhir-integration.md` | `fhir-integration` | (1) retry sem backoff em 4xx (exceto 401); (2) LOINC obrigatório em Observations; (3) CPF usar sistema `http://www.brazil.gov.br/cpf` |
| `rules/test-generator.md` | `test-generator` | (1) `tenantId` em toda query testada; (2) caso positivo + negativo em limiares clínicos; (3) nunca testar implementação interna |
| `rules/github-organizer.md` | `github-organizer` | (1) Conventional Commits lowercase; (2) nunca `git add -A` sem revisar; (3) Co-Authored-By obrigatório |
| `rules/performance.md` | `performance` | (1) `take` obrigatório em arrays Prisma aninhados; (2) aggregation no banco, não em memória; (3) invalidação cirúrgica no React Query |
| `rules/code-simplifier.md` | `code-simplifier` | (1) nunca simplificar além do escopo modificado; (2) nunca remover `tenantId` de queries; (3) nunca alterar ordem do pipeline clínico |
| `rules/ux-accessibility.md` | `ux-accessibility` | (1) tokens `priority.*` para cores clínicas; (2) foco visível sempre presente; (3) nunca `<div>` clicável sem `role="button"` |
| `rules/architect.md` | `architect` | (1) ai-service nunca chama banco diretamente; (2) actions executadas apenas pelo backend; (3) ordem de guards globais é invariante |
| `rules/product-owner.md` | `product-owner` | (1) toda issue com label de domínio; (2) issues clínicas exigem validação `clinical-domain`; (3) novos tipos de câncer fora do MVP |
| `rules/documentation.md` | `documentation` | (1) nunca dados de pacientes em docs; (2) ADR para toda decisão irreversível; (3) documentação obsoleta marcada, nunca deletada |

---

## Tabela de Acionamento Situacional

| Situação | Agente a acionar |
|----------|-----------------|
| Tarefas em `backend/src/` ou `backend/prisma/` | `backend-nestjs` |
| Tarefas em `frontend/src/` | `frontend-nextjs` |
| Tarefas em `ai-service/` | `ai-service` |
| Schema Prisma, migrations, queries lentas | `database-engineer` |
| Modelos ML, features, MASCC/CISNE | `data-scientist` |
| Prompts, context_builder, janela de contexto | `llm-context-engineer` |
| Corpus RAG, FAISS, qualidade de retrieval | `rag-engineer` |
| Arquitetura de orchestrator, subagentes | `llm-agent-architect` |
| Docker, CI/CD de aplicação | `devops` |
| Infraestrutura AWS (ECS, RDS, VPC) | `aws` |
| Terraform IaC | `terraform` |
| HL7/FHIR, interoperabilidade hospitalar | `fhir-integration` |
| WhatsApp Business API, webhook | `whatsapp-integration` |
| Validação de lógica clínica oncológica | `clinical-domain` |
| UX, acessibilidade WCAG | `ux-accessibility` |
| Performance, bundle, N+1, endpoint lento, nova query Prisma com `include`, mudança de bundle Next.js | `performance` |
| Documentação técnica, OpenAPI, docs CEP | `documentation` |
| Decisões arquiteturais cross-layer | `architect` |
| Gestão de backlog, milestones, issues | `product-owner` (via `/po`) |
| Qualquer código novo ou modificado | `test-generator` (sempre) |
| Criar/modificar endpoint, service, DTO ou guard | `seguranca-compliance` (sempre) |
| Qualquer commit | `github-organizer` (sempre) |

---

## Referências

- [squads.md](.claude/squads.md) — definição oficial dos squads
- [CLAUDE.md](../CLAUDE.md) — guia geral do projeto e workflow de agentes

### Rules por domínio (18 arquivos)

| Squad | Rule file |
|-------|-----------|
| Produto | [rules/architect.md](.claude/rules/architect.md) · [rules/product-owner.md](.claude/rules/product-owner.md) · [rules/documentation.md](.claude/rules/documentation.md) |
| Clínico | [rules/clinical-domain.md](.claude/rules/clinical-domain.md) · [rules/fhir-integration.md](.claude/rules/fhir-integration.md) · [rules/whatsapp-integration.md](.claude/rules/whatsapp-integration.md) |
| Plataforma | [rules/backend.md](.claude/rules/backend.md) · [rules/frontend.md](.claude/rules/frontend.md) · [rules/database.md](.claude/rules/database.md) · [rules/ux-accessibility.md](.claude/rules/ux-accessibility.md) |
| IA/Dados | [rules/ai-service.md](.claude/rules/ai-service.md) |
| Infra/Cloud | [rules/devops.md](.claude/rules/devops.md) · [rules/aws.md](.claude/rules/aws.md) · [rules/terraform.md](.claude/rules/terraform.md) |
| Qualidade | [rules/security.md](.claude/rules/security.md) · [rules/test-generator.md](.claude/rules/test-generator.md) · [rules/performance.md](.claude/rules/performance.md) · [rules/github-organizer.md](.claude/rules/github-organizer.md) · [rules/code-simplifier.md](.claude/rules/code-simplifier.md) |
