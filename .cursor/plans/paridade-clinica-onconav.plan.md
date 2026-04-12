---
name: Paridade clínica ONCONAV
overview: Alinhar regras determinísticas, prompts LLM, protocolos (NestJS/DB/Python) e contratos frontend; corrigir lacunas identificadas na pesquisa em camadas e na análise cruzada.
todos:
  - id: p0-clinical-thresholds
    content: "ai-service: criar clinical_thresholds.py; importar em protocol_engine e questionnaire_engine (ESAS/PRO-CTCAE)"
    status: completed
  - id: p0-system-prompt-align
    content: "ai-service: alinhar _get_symptom_detection_rules a clinical_rules (dor ≥9, 7-8, 5-6, SpO2<92, delta ECOG)"
    status: pending
  - id: p1-convert-db-protocol
    content: "ai-service: _convert_db_protocol — mesclar criticalSymptoms raiz do Prisma com estágios ou documentar/ajustar contrato JSON do seed"
    status: pending
  - id: p1-protocol-rules-fallback
    content: "ai-service: estender PROTOCOL_RULES ou fallback explícito para breast/lung/other (ou garantir protocolo DB completo para todos os tipos habilitados)"
    status: pending
  - id: p1-frontend-journey-types
    content: "frontend: incluir PALLIATIVE em getStepsByStage/initializeSteps (oncology-navigation.ts); alinhar retorno createMissingStepsForStage"
    status: pending
  - id: p2-navigation-api-unify
    content: "frontend: consolidar navigationApi vs oncologyNavigationApi (wrapper único ou reexports)"
    status: pending
  - id: p2-contract-snapshot
    content: Script export JSON + ativar test_protocol_rules_contract.py após shared/clinical-protocol-snapshot.v1.json
    status: pending
isProject: false
---

# Plano: paridade clínica ONCONAV (atualizado)

Documentação de referência já existente:

- [docs/desenvolvimento/clinical-parity-audit.md](../../docs/desenvolvimento/clinical-parity-audit.md) — matriz de paridade, scan, contrato, backlog inicial
- [docs/desenvolvimento/clinical-parity-cross-analysis.md](../../docs/desenvolvimento/clinical-parity-cross-analysis.md) — pesquisa separada Frontend / Backend / ai-service e **cruzamento**

Este arquivo é o **plano operacional** consolidado; os to-dos acima substituem a lista pontual anterior e incorporam achados da análise cruzada.

---

## Contexto resumido

Há **várias fontes** de verdade para o mesmo domínio clínico: templates TypeScript e linhas `ClinicalProtocol` no backend, `PROTOCOL_RULES` embutido no Python, regras em `clinical_rules.py`, instruções ao LLM em `system_prompt.py`, e tipos/listas no frontend. A pesquisa cruzada mostrou **lacunas** além do escopo original “P0 só constantes + prompt”:

1. **`_convert_db_protocol`** pode não aplicar `criticalSymptoms` **raiz** do Prisma aos estágios — sintomas do protocolo no banco podem não alimentar a avaliação por fase no `protocol_engine`.
2. **`PROTOCOL_RULES`** cobre **4** tipos de câncer; templates NestJS têm **8** — risco quando não há protocolo ativo no DB ou formato incompleto.
3. **Frontend:** unions sem `PALLIATIVE`; dois clientes HTTP paralelos.

---

## Fase P0 — ai-service (rápido, alto impacto na consistência)

| Ação | Arquivos |
|------|----------|
| Módulo único de limiares | Novo `ai-service/src/agent/clinical_thresholds.py`; remover duplicatas em [`protocol_engine.py`](../../ai-service/src/agent/protocol_engine.py), [`questionnaire_engine.py`](../../ai-service/src/agent/questionnaire_engine.py) |
| Prompt alinhado às regras hard | [`system_prompt.py`](../../ai-service/src/agent/prompts/system_prompt.py) `_get_symptom_detection_rules` ↔ [`clinical_rules.py`](../../ai-service/src/agent/clinical_rules.py) |

**Validação:** `pytest` no `ai-service`.

**Revisão:** agente clinical-domain / llm-context-engineer conforme regras do repositório.

---

## Fase P1 — contrato protocolo Backend ↔ ai-service

| Ação | Detalhe |
|------|---------|
| Corrigir ou documentar conversão | Se o JSON persistido em `ClinicalProtocol` guarda `criticalSymptoms` no **raiz**, [`_convert_db_protocol`](../../ai-service/src/agent/protocol_engine.py) deve **mesclar** esse vetor em cada estágio (ou replicar lista em todos os `stage_rules["critical_symptoms"]`) — definir comportamento clínico desejado com clinical-domain. |
| Fallback por tipo | Para `breast` / `lung` / `other`: ou entradas em `PROTOCOL_RULES`, ou política clara “sempre exige protocolo ativo no tenant” com seed garantido. |

---

## Fase P1 — frontend

| Ação | Arquivos |
|------|----------|
| Tipos de jornada completos | [`frontend/src/lib/api/oncology-navigation.ts`](../../frontend/src/lib/api/oncology-navigation.ts) — `PALLIATIVE` em `getStepsByStage`, `initializeSteps` |
| Resposta de API | Alinhar tipo de `createMissingStepsForStage` com payload real do NestJS (`message` opcional) |

---

## Fase P2 — consolidação e CI

| Ação | Detalhe |
|------|---------|
| API clients | Um módulo fino ou reexport — reduzir drift entre [`navigation.ts`](../../frontend/src/lib/api/navigation.ts) e [`oncology-navigation.ts`](../../frontend/src/lib/api/oncology-navigation.ts) |
| Snapshot + teste | Gerar `shared/clinical-protocol-snapshot.v1.json`; remover `skip` de [`test_protocol_rules_contract.py`](../../ai-service/tests/test_protocol_rules_contract.py) quando fixture estável |

---

## Fora de escopo imediato

- Derivar `TREATMENT_OPTIONS_BY_CANCER_TYPE` dos protocolos (mudança de produto maior).
- Documentação `.cursor/agents/clinical-domain.md` vs número de regras R01–R23 (manutenção contínua).

---

## Ordem sugerida de execução

1. P0 clinical_thresholds + system_prompt (menor superfície, desbloqueia consistência imediata).
2. P1 `_convert_db_protocol` / criticalSymptoms (validar com exemplo real de JSON no DB).
3. P1 PROTOCOL_RULES ou política de DB-only para tipos 5–8.
4. P1 frontend tipos `PALLIATIVE`.
5. P2 unificação de clientes e snapshot CI.

---

## Execução detalhada por to-do

### `p0-clinical-thresholds`

**Objetivo:** uma única definição numérica para alertas ESAS/PRO-CTCAE usada em protocolo e questionários.

**Passos e subitens:**

1. **Criar** [`clinical_thresholds.py`](../../ai-service/src/agent/clinical_thresholds.py)
   - **1.1** Arquivo no pacote `src/agent/`, sem dependência de `orchestrator` ou rotas.
   - **1.2** Exportar três constantes com os valores atuais de `protocol_engine`: `ESAS_ALERT_THRESHOLD`, `ESAS_TOTAL_ALERT`, `PRO_CTCAE_ALERT_GRADE`.
   - **1.3** Comentário de uma linha por constante (sem alterar números sem revisão clínica).

2. **Ajustar** [`protocol_engine.py`](../../ai-service/src/agent/protocol_engine.py)
   - **2.1** Remover linhas locais que definem as três constantes + `ESAS_TOTAL_ALERT` se estiver só ali.
   - **2.2** `from .clinical_thresholds import ESAS_ALERT_THRESHOLD, ESAS_TOTAL_ALERT, PRO_CTCAE_ALERT_GRADE` (ajustar lista ao que for usado no arquivo).
   - **2.3** Garantir que `_evaluate_esas_scores` e qualquer referência a limiares use os imports (sem números mágicos restantes).

3. **Ajustar** [`questionnaire_engine.py`](../../ai-service/src/agent/questionnaire_engine.py)
   - **3.1** Remover `ESAS_ALERT_THRESHOLD` e `PRO_CTCAE_ALERT_GRADE` locais (linhas ~233–237).
   - **3.2** Importar do `clinical_thresholds`; `ESAS_TOTAL_ALERT` só entra se o questionário avaliar total ESAS no mesmo módulo (hoje pode não existir — não importar o que não for usado).

4. **Verificação estática**
   - **4.1** `rg "ESAS_ALERT_THRESHOLD|ESAS_TOTAL_ALERT|PRO_CTCAE_ALERT_GRADE" ai-service/src` — apenas `clinical_thresholds.py` + usos, não novas definições.
   - **4.2** Abrir import do Python: `python -c "from src.agent.clinical_thresholds import ESAS_ALERT_THRESHOLD"` a partir da pasta `ai-service` (ou equivalente no CI).

**Pronto quando:** `pytest ai-service/tests` passa; imports circulares inexistentes.

**Dono sugerido:** ai-service.

---

### `p0-system-prompt-align`

**Objetivo:** o texto instrucional ao LLM não contradizer `clinical_rules.py` nos limiares numéricos.

**Passos e subitens:**

1. **Leitura de referência** em [`clinical_rules.py`](../../ai-service/src/agent/clinical_rules.py)
   - **1.1** R03: SpO2 &lt; 92.
   - **1.2** R08: dor ≥9; R16: 7–8; R19: 5–6.
   - **1.3** R09 / R18: delta ECOG ≥2 vs ==1 (e mensagens de `reason` para não contradizer o prompt).

2. **Editar** [`_get_symptom_detection_rules`](../../ai-service/src/agent/prompts/system_prompt.py)
   - **2.1** Seção **CRÍTICO:** dor **≥9/10**; SpO2 **&lt; 92%**; delta ECOG **≥2**; manter itens já corretos (febre ≥38°C em contexto quimio, etc.).
   - **2.2** Seção **ALTA:** dor **7–8/10** (não misturar com 5–6).
   - **2.3** Seção **MODERADO / consulta antecipada:** dor **5–6/10**; piora funcional leve (delta ECOG +1) se couber na mesma hierarquia textual.
   - **2.4** Opcional: uma linha explícita “8/10 não é o mesmo critério que 9/10 para PS imediato” para reduzir confusão do modelo.
   - **2.5** Não alterar `_get_base_prompt` nem `build_system_prompt` além do necessário para colar coerência.

3. **Escopo**
   - **3.1** Não mudar `clinical_rules.py` neste to-do; se encontrar inconsistência real nas regras, abrir item separado.

**Pronto quando:** revisão llm-context-engineer + clinical-domain; smoke manual (dor 8 vs 9) se possível.

**Dono sugerido:** ai-service + revisão clínica.

---

### `p1-convert-db-protocol`

**Objetivo:** sintomas críticos persistidos no Prisma (`criticalSymptoms` raiz) influenciem `protocol_engine` quando o protocolo vem do DB.

**Passos e subitens:**

1. **Descoberta do formato real**
   - **1.1** Query ou seed: um registro `ClinicalProtocol` de dev com `cancerType` bladder ou outro.
   - **1.2** Confirmar shape de `criticalSymptoms` (array de objetos com `keyword`? string só?).
   - **1.3** Confirmar se `checkInRules.TREATMENT` (e outros) trazem `criticalSymptoms` aninhados ou só frequência/questionário.

2. **Implementar** em [`_convert_db_protocol`](../../ai-service/src/agent/protocol_engine.py)
   - **2.1** Ler `protocol.get("criticalSymptoms")` na raiz.
   - **2.2** Função auxiliar `_keywords_from_critical_symptoms_list(raw) -> List[str]` se o formato for objeto (extrair `keyword`).
   - **2.3** Para cada `stage` em `check_in_rules`: `critical_symptoms` = merge de (lista do estágio, se houver) + (lista raiz normalizada), **ou** replicar raiz em todos os estágios conforme decisão clínica.
   - **2.4** Evitar duplicatas e manter ordem estável (sort opcional só para testes).

3. **Documentação condicional**
   - **3.1** Se optar por “só por estágio no JSON”: atualizar [`clinical-parity-audit.md`](../../docs/desenvolvimento/clinical-parity-audit.md) + alinhar seed/migration backend.

4. **Testes**
   - **4.1** `tests/test_protocol_engine.py` ou novo arquivo: fixture mínima `protocol` com `checkInRules` simples + `criticalSymptoms` raiz; assert que estágio TREATMENT recebe lista não vazia após conversão.

**Pronto quando:** teste passa; comportamento acordado com clinical-domain.

**Dono sugerido:** ai-service (+ backend se mudar seed).

---

### `p1-protocol-rules-fallback`

**Objetivo:** tipos `breast`, `lung`, `other` não ficarem sem regras quando não houver linha no DB ou `checkInRules` vazio.

**Passos e subitens:**

1. **Decisão (A vs B)** — reunião curta ou ADR curto
   - **1.1 (A)** Estender `PROTOCOL_RULES` com três chaves novas, preenchidas a partir dos templates TS (paridade manual inicial).
   - **1.2 (B)** Garantir que todo tenant tenha `ClinicalProtocol` ativo para cada tipo em `enabledCancerTypes`; agente nunca chama com protocol nulo para esses tipos.
   - **1.3** Registrar a decisão no plano ou em `docs/desenvolvimento/` para não reabrir.

2. **Se (A)**
   - **2.1** Para cada novo tipo: copiar esqueleto de estágios SCREENING…FOLLOW_UP como em [`PROTOCOL_RULES["bladder"]`](../../ai-service/src/agent/protocol_engine.py).
   - **2.2** Preencher `check_in_frequency`, `questionnaire`, `critical_symptoms` por estágio a partir de [`breast.protocol.ts`](../../backend/src/clinical-protocols/templates/breast.protocol.ts) etc. (subconjunto: não precisa copiar `journeyStages.steps` inteiros).
   - **2.3** Teste pytest: `PROTOCOL_RULES.get("lung")` não é `None`.

3. **Se (B)**
   - **3.1** Seed/migration cria protocolos para combinação tenant × cancerType habilitado.
   - **3.2** Em `_get_rules`: se `protocol` ausente e tipo não mapeado, log structured + lista vazia de ações ou resposta segura documentada.

4. **Validação ponta a ponta**
   - **4.1** Caso de teste: `cancerType: lung`, `protocol: null` — comportamento explícito (fallback A ou erro B).

**Pronto quando:** cenário breast/lung/other coberto por teste ou QA checklist.

**Dono sugerido:** architect + clinical-domain + ai-service.

---

### `p1-frontend-journey-types`

**Objetivo:** TypeScript refletir o enum Prisma e evitar chamadas incorretas à API.

**Passos e subitens:**

1. **Arquivo** [`oncology-navigation.ts`](../../frontend/src/lib/api/oncology-navigation.ts)
   - **1.1** Tipo union `JourneyStageParam` (opcional) exportado reutilizando [`JourneyStage`](../../frontend/src/lib/utils/journey-stage.ts) de `journey-stage.ts` se já existir tipo — evita cinco unions repetidos.
   - **1.2** `getStepsByStage(patientId, journeyStage)`: segundo parâmetro inclui `'PALLIATIVE'`.
   - **1.3** `initializeSteps(..., currentStage)`: inclui `'PALLIATIVE'`.

2. **Alinhar retorno** `createMissingStepsForStage`
   - **2.1** Ler método real em [`oncology-navigation.service.ts`](../../backend/src/oncology-navigation/oncology-navigation.service.ts) (createMissingStepsForStage / controller) para lista exata de chaves.
   - **2.2** Unificar tipo com [`navigation.ts`](../../frontend/src/lib/api/navigation.ts): `message?: string` se o backend enviar sempre ou às vezes.

3. **Verificação**
   - **3.1** `npm run type-check` / `tsc --noEmit` no frontend.
   - **3.2** Corrigir componentes que passam literal de estágio (ex.: wizard) se TS acusar exclusão de `PALLIATIVE`.

**Pronto quando:** typecheck limpo; hooks sem regressão.

**Dono sugerido:** frontend-nextjs.

---

### `p2-navigation-api-unify`

**Objetivo:** um só lugar para paths/DTOs de `/oncology-navigation/*`, reduzindo drift.

**Passos e subitens:**

1. **Inventário**
   - **1.1** Tabela: método → arquivo → consumidores (grep `navigationApi` / `oncologyNavigationApi`).
   - **1.2** Marcar canônico: recomenda-se manter implementações em `oncology-navigation.ts`.

2. **Estratégia de consolidação**
   - **2.1** Opção A: `navigation.ts` reexporta tudo de `oncology-navigation.ts` + alias `export const navigationApi = oncologyNavigationApi` se assinaturas baterem.
   - **2.2** Opção B: renomear export único e atualizar N imports (mais trabalhoso, API mais limpa).
   - **2.3** `uploadFile`: manter no canônico; documentar por que FormData pode precisar de axios cru.

3. **Migração de imports**
   - **3.1** Atualizar [`patient-navigation-tab.tsx`](../../frontend/src/components/patients/patient-navigation-tab.tsx), [`oncology-navigation/page.tsx`](../../frontend/src/app/oncology-navigation/page.tsx), [`useOncologyNavigation.ts`](../../frontend/src/hooks/useOncologyNavigation.ts), [`create-navigation-step-dialog.tsx`](../../frontend/src/components/patients/create-navigation-step-dialog.tsx), [`navigation-step-dialog.tsx`](../../frontend/src/components/patients/navigation-step-dialog.tsx) conforme grep.

4. **Critério**
   - **4.1** Um único arquivo contém paths; o outro é fino ou removido após deprecação em comentário.

**Pronto quando:** grep consistente; sem métodos duplicados com assinaturas divergentes.

**Dono sugerido:** frontend-nextjs.

---

### `p2-contract-snapshot`

**Objetivo:** CI falha se `PROTOCOL_RULES` (e futuramente thresholds) divergirem do export canônico do backend.

**Passos e subitens:**

1. **Script backend** (ex. `backend/scripts/export-protocol-snapshot.ts`)
   - **1.1** Importar `PROTOCOL_TEMPLATES` (exportar constante do service ou duplicar mapa de templates só para o script — preferir import do service se já exportável).
   - **1.2** Serializar para JSON versão `version: 1`, `cancerTypes`, e subcampos alinhados ao que `test_protocol_rules_contract` validará.
   - **1.3** npm script: `"export-protocol-snapshot": "ts-node ..."` ou `npx tsx`.

2. **Artefato no repo**
   - **2.1** Criar [`shared/`](../../shared/) na raiz se não existir.
   - **2.2** Commitar [`clinical-protocol-snapshot.v1.json`](../../shared/clinical-protocol-snapshot.v1.json) ou gerar em CI e comparar hash (decidir: commitado vs gerado só no CI).

3. **Teste Python**
   - **3.1** [`test_protocol_rules_contract.py`](../../ai-service/tests/test_protocol_rules_contract.py): `_snapshot_path()` = `Path(__file__).resolve().parents[2] / "shared" / "clinical-protocol-snapshot.v1.json"` (ajustar `parents` conforme layout real).
   - **3.2** Remover `skip`; asserts para `checkInRules`/`stages` após fechar `p1-convert-db-protocol` (schema estável).

4. **CI**
   - **4.1** Job: checkout → opcionalmente rodar export e `git diff --exit-code` no JSON → `pytest` teste de contrato.
   - **4.2** Documentar em README ou [`docs/desenvolvimento/`](../../docs/desenvolvimento/) como regenerar o snapshot após mudar templates.

**Pronto quando:** pipeline verde; instrução “como atualizar snapshot” escrita.

**Dono sugerido:** backend-nestjs + ai-service + devops (CI).
