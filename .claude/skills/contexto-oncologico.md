# Skill: /contexto-oncologico

## Descrição

Carrega contexto completo do domínio oncológico para informar decisões de desenvolvimento.

## Uso

```
/contexto-oncologico
```

## Contexto Carregado

### Arquivos de Domínio

1. **Navegação Oncológica** (`.cursor/rules/navegacao-oncologica.mdc` - 36KB)
   - Jornada do paciente: SCREENING → DIAGNOSIS → TREATMENT → FOLLOW_UP
   - NavigationSteps por tipo de câncer
   - Regras de timing e dependências entre etapas
   - Critérios de priorização

2. **Oncologista** (`.cursor/rules/oncologista.mdc` - 32KB)
   - Terminologia oncológica (TNM, ECOG, biomarcadores)
   - Protocolos de tratamento por tipo de câncer
   - Critérios de toxicidade (CTCAE grades)
   - Guidelines de manejo de sintomas

3. **Plano de Agentes IA** (`docs/desenvolvimento/plano-agentes-ia.md` - 37KB)
   - Arquitetura do agente conversacional
   - Pipeline: mensagem → sintomas → protocolo → RAG → LLM → ações
   - Questionários ESAS e PRO-CTCAE
   - Regras semi-autônomas (auto-aprovado vs requer aprovação)
   - Modelos de dados (Conversation, AgentDecisionLog, ScheduledAction, ClinicalProtocol)

4. **Especificação Técnica** (`SPECS.md` - 44KB)
   - Modelo de dados completo
   - Endpoints da API
   - Integração WhatsApp Business
   - Sistema de alertas (13 tipos)
   - Dashboard de enfermagem

### Tipos de Câncer Suportados

- **Colorretal**: colonoscopia, CEA, KRAS/BRAF/MSI, cirurgia, FOLFOX/FOLFIRI
- **Bexiga**: cistoscopia, RTU, BCG, cistectomia
- **Renal**: TC, nefrectomia, sunitinibe/pazopanibe, imunoterapia
- **Próstata**: PSA, biópsia, prostatectomia, radioterapia, ADT

### Questionários Validados

- **ESAS**: 9 itens (0-10), alerta se ≥7 ou total ≥50
- **PRO-CTCAE**: 10 sintomas (grade 0-4), alerta se ≥3
