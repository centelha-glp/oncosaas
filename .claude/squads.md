# ONCONAV — Squads de Agentes

19 agentes organizados em 6 squads. Cada squad pode ser acionado como agent team para trabalho paralelo em sua área.

---

## Squad Produto
> Visão estratégica, arquitetura e documentação

| Agente | Responsabilidade |
|--------|-----------------|
| `product-owner` | Backlog, milestones, issues no GitHub |
| `architect` | Decisões cross-layer, consistência arquitetural |
| `documentation` | OpenAPI, guias técnicos, docs CEP/EBSERH |

**Acionar quando**: planejar nova feature, revisar arquitetura, estruturar backlog, documentar APIs.

---

## Squad Clínico
> Domínio oncológico e integrações de saúde

| Agente | Responsabilidade |
|--------|-----------------|
| `clinical-domain` | Protocolos, regras de triagem, terminologia clínica |
| `fhir-integration` | HL7/FHIR R4, interoperabilidade com HIS/PEP |
| `whatsapp-integration` | WhatsApp Business API, webhook, opt-in, templates |

**Acionar quando**: implementar/validar lógica clínica, integrar com sistemas hospitalares, configurar canais de comunicação com pacientes.

---

## Squad Plataforma
> Engenharia core da aplicação

| Agente | Responsabilidade |
|--------|-----------------|
| `backend-nestjs` | NestJS, Prisma, módulos, controllers, services |
| `frontend-nextjs` | Next.js, React, componentes, hooks |
| `database-engineer` | Schema Prisma, migrations, queries, índices |
| `ux-accessibility` | WCAG 2.1 AA, UX para profissionais de saúde |

**Acionar quando**: desenvolver features end-to-end, criar novos módulos, otimizar queries, revisar UI.

---

## Squad IA/Dados
> Inteligência artificial e ciência de dados

| Agente | Responsabilidade |
|--------|-----------------|
| `ai-service` | FastAPI, agente conversacional, pipeline ML |
| `data-scientist` | LightGBM, features, MASCC/CISNE, bias em modelos |
| `llm-agent-architect` | Arquitetura de orchestrator, subagentes, agentic loops, tool use |
| `llm-context-engineer` | Prompts, context_builder, janela de contexto, prompt caching |
| `rag-engineer` | Corpus oncológico, FAISS, embeddings, qualidade de retrieval |

**Acionar quando**: evoluir o modelo de priorização, ajustar regras clínicas no ai-service, analisar dados de retreino, validar scores clínicos, melhorar qualidade das respostas do agente, otimizar RAG, reduzir custo de tokens.

---

## Squad Infra/Cloud
> Infraestrutura, cloud e operações

| Agente | Responsabilidade |
|--------|-----------------|
| `devops` | Docker, GitHub Actions, CI/CD de aplicação |
| `aws` | ECS Fargate, RDS, ElastiCache, VPC, IAM, CloudWatch |
| `terraform` | IaC, módulos Terraform, state, provisionamento |

**Acionar quando**: configurar infraestrutura AWS, criar pipelines de deploy, provisionar novos recursos, escalar serviços.

---

## Squad Qualidade
> Qualidade, segurança e entrega — transversal a todos os squads

| Agente | Responsabilidade |
|--------|-----------------|
| `seguranca-compliance` | LGPD/HIPAA, multi-tenancy, audit trail |
| `test-generator` | Testes unitários e E2E |
| `performance` | Bundle, N+1, Redis, Core Web Vitals |
| `github-organizer` | Commits atômicos, PRs estruturadas |

**Acionar quando**: antes de qualquer commit (obrigatório: `test-generator` → `seguranca-compliance` → `github-organizer`), revisar performance, auditar segurança.

---

## Fluxo de Agent Team por Tipo de Tarefa

### Nova feature end-to-end
```
Squad Produto (architect define contrato)
  → Squad Plataforma (backend + frontend + db em paralelo)
  → Squad Qualidade (testes + segurança + commit)
```

### Feature com lógica clínica
```
Squad Clínico (clinical-domain valida regras)
  → Squad IA/Dados (ai-service implementa)
  → Squad Plataforma (backend expõe endpoint)
  → Squad Qualidade
```

### Deploy em produção
```
Squad Infra/Cloud (terraform + aws planejam)
  → Squad Qualidade (devops executa CI/CD)
```

### Pesquisa CEP/EBSERH
```
Squad Clínico (clinical-domain — terminologia)
  → Squad Produto (documentation — redigir docs)
  → Squad IA/Dados (data-scientist — metodologia ML)
```
