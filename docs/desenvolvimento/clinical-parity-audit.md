# Auditoria de paridade: lógica clínica duplicada (ONCONAV)

Documento gerado pela implementação do plano de verificação de códigos clínicos duplicados e dessincronizados. Serve como **matriz de paridade**, registro de **scan mecânico**, **especificação de contrato** para testes futuros e **backlog de consolidação**.

**Pesquisa em camadas (Frontend / Backend / ai-service) e análise cruzada:** [clinical-parity-cross-analysis.md](clinical-parity-cross-analysis.md).

---

## 1. Matriz de paridade (status)

Legenda: **OK** alinhado | **DIVERGENTE** risco de comportamento diferente | **N/A** modelo de dados diferente (não comparável 1:1) | **ESTRUTURAL** mesmo domínio, representação distinta

### 1.1 Protocolo `bladder`: `bladder.protocol.ts` vs `PROTOCOL_RULES["bladder"]`

| Campo | Backend `checkInRules` / estágio | Python `protocol_engine` | Status |
|-------|----------------------------------|----------------------------|--------|
| SCREENING | `weekly`, `questionnaire: null` | `weekly`, `null` | OK |
| DIAGNOSIS | `twice_weekly`, `null` | `twice_weekly`, `null` | OK |
| TREATMENT | `daily`, `ESAS` | `daily`, `ESAS` | OK |
| FOLLOW_UP | `weekly`, `PRO_CTCAE` | `weekly`, `PRO_CTCAE` | OK |
| Sintomas críticos | Lista **global** em `criticalSymptoms[]` (keyword + severity + action) | Listas **por estágio** em `stages.*.critical_symptoms` (só strings) | ESTRUTURAL |
| SCREENING sintomas | *Não por estágio no TS* | `hematúria`, `sangue na urina`, `dor ao urinar` | N/A vs lista global |
| TREATMENT sintomas TS | Globais incluem `hematúria intensa`, `retenção urinária`, `febre neutropênica`, etc. | `hematúria intensa`, `retenção urinária`, `febre neutropênica`, `cistite grave` | OK (subconjunto/superset: `cistite grave` só no Python) |
| FOLLOW_UP | Globais não listam `hematúria recorrente` / `dor pélvica` | `hematúria recorrente`, `dor pélvica` | DIVERGENTE (agente enfatiza sintomas de follow-up que não aparecem na lista plana do template) |

**Conclusão:** frequências e questionários batem. Sintomas críticos **não** são o mesmo modelo: backend = um vetor global; Python = por estágio + termos extras (`cistite grave`, listas de rastreamento no SCREENING).

### 1.2 `clinical_rules.py` vs `_get_symptom_detection_rules()` (`system_prompt.py`)

| Tema | Regras hard (`clinical_rules.py`) | Prompt (trecho) | Status |
|------|-----------------------------------|-----------------|--------|
| Febre urgência quimio | `temperature >= 38.0` + quimio/janela (R01, etc.) | "Febre ≥38°C em quimioterapia" | OK |
| Hipóxemia | `spo2 < 92` | Não explícito no bloco de detecção (foco dispneia) | DIVERGENTE (cobertura textual incompleta) |
| Dor emergência | `pain >= 9` → ER_IMMEDIATE (R08) | "Dor intensa (8-10/10)" em CRÍTICO | DIVERGENTE (prompt sugere 8+, regra hard 9+) |
| Dor urgência 24h | R16: 7–8 | "6-7/10" em ALTA GRAVIDADE | DIVERGENTE (faixas sobrepostas e rótulos diferentes) |
| Delta ECOG | `>= 2` IMEDIATO, `== 1` ADVANCE | Não citado no prompt de sintomas | DIVERGENTE (LLM sem espelho dos limiares) |

**Conclusão:** alinhamento parcial em febre; **divergência material** em limiares de dor e SpO2/ECOG entre prompt e Layer 1.

### 1.3 Limiares ESAS / PRO-CTCAE (Python)

| Constante | `protocol_engine.py` | `questionnaire_engine.py` | Status |
|-----------|----------------------|---------------------------|--------|
| `ESAS_ALERT_THRESHOLD` | `7` | `7` | OK (valor igual; **código duplicado** — dois `def` de constante) |
| `ESAS_TOTAL_ALERT` | `50` | *(não presente no trecho analisado)* | Verificar uso só em `protocol_engine` |
| `PRO_CTCAE_ALERT_GRADE` | `3` | `3` | OK (duplicado igual) |

### 1.4 `JourneyStage`: Prisma vs frontend

| Fonte | Valores / ordem |
|-------|-----------------|
| Prisma `JourneyStage` | `SCREENING` → `DIAGNOSIS` → `TREATMENT` → `FOLLOW_UP` → `PALLIATIVE` |
| `frontend/src/lib/utils/journey-stage.ts` | Mesma ordem em `JOURNEY_STAGES` / `JOURNEY_STAGE_ORDER` | OK |
| `oncology-navigation.ts` `getStepsByStage` | Union **sem** `PALLIATIVE` | DIVERGENTE |
| `oncology-navigation.ts` `initializeSteps` | `currentStage` sem `PALLIATIVE` | DIVERGENTE |
| `navigation.ts` | `journeyStage` em update: inclui `PALLIATIVE` | OK |

### 1.5 Clientes HTTP: `navigation.ts` vs `oncology-navigation.ts`

| Método / rota | `navigationApi` | `oncologyNavigationApi` | Status |
|---------------|-----------------|---------------------------|--------|
| GET steps | `/oncology-navigation/patients/:id/steps` | Idem | OK |
| GET by stage | Idem | Idem | OK |
| PATCH step | Idem | Idem | OK |
| POST create step | Idem | Idem | OK |
| DELETE step | Idem | Idem | OK |
| Templates | Idem | Idem | OK |
| create-from-template | Idem | Idem | OK |
| create-missing | Idem | OK | DIVERGENTE tipo retorno: `{ created, skipped, message }` vs `{ created, skipped }` |
| upload arquivo | Não exposto | `uploadFile` (axios direto) | N/A (extensão só em um cliente) |

---

## 2. Scan mecânico (jscpd + busca)

### 2.1 jscpd (amostra relevante)

- **Backend:** clones frequentes em `*.spec.ts` (arranjos de teste), padrões repetidos em `comorbidities`/`medications` controllers, `alerts.gateway` vs `messages.gateway` (similaridade WebSocket). **Severidade:** em geral **cosmética / manutenção**, não regra clínica.
- **Frontend:** duplicação local em componentes de dashboard (charts/modal). **Cosmética.**
- **ai-service `src/agent`:** poucos clones (llm_provider, context_builder). **Cosmética.**

**Constantes clínicas duplicadas entre arquivos** não são bem capturadas pelo jscpd (limiar de tokens); usar **grep** obrigatório:

```bash
rg "ESAS_ALERT_THRESHOLD|PRO_CTCAE_ALERT_GRADE" ai-service/src
```

Resultado: **duas** definições de `ESAS_ALERT_THRESHOLD` e `PRO_CTCAE_ALERT_GRADE` (`protocol_engine.py` e `questionnaire_engine.py`).

### 2.2 Classificação rápida

| Achado | Severidade clínica | Severidade manutenção |
|--------|--------------------|------------------------|
| Dois `ESAS_ALERT_THRESHOLD=7` | Baixa se valores iguais | Alta (drift futuro) |
| Prompt dor 8–10 vs regra 9+ | **Alta** (comportamento LLM vs triagem) | Alta |
| `getStepsByStage` sem PALLIATIVE | Média (typing incorreto) | Média |
| PROTOCOL_RULES vs `criticalSymptoms` global | Média | Alta |

---

## 3. Especificação de contrato (testes futuros)

### 3.1 Objetivo

Falhar CI se o subconjunto “agente” (`PROTOCOL_RULES` + limiares) divergir do que o backend declara nos templates TypeScript, **sem** substituir revisão clínica humana.

### 3.2 Formato JSON canônico (versão)

Nome sugerido no repo: `shared/clinical-protocol-snapshot.v1.json` (ou gerado em `backend/dist` e consumido pelo CI).

```json
{
  "version": 1,
  "generatedAt": "ISO-8601",
  "source": "backend/clinical-protocols/templates",
  "cancerTypes": {
    "bladder": {
      "checkInRules": {
        "SCREENING": { "frequency": "weekly", "questionnaire": null },
        "DIAGNOSIS": { "frequency": "twice_weekly", "questionnaire": null },
        "TREATMENT": { "frequency": "daily", "questionnaire": "ESAS" },
        "FOLLOW_UP": { "frequency": "weekly", "questionnaire": "PRO_CTCAE" }
      },
      "criticalSymptomsByStage": {
        "SCREENING": ["..."],
        "DIAGNOSIS": ["..."],
        "TREATMENT": ["..."],
        "FOLLOW_UP": ["..."]
      }
    }
  },
  "thresholds": {
    "esasItemAlert": 7,
    "esasTotalAlert": 50,
    "proCtcaeGradeAlert": 3
  }
}
```

**Nota:** hoje o backend **não** expõe `criticalSymptomsByStage` — só lista global. Opções:

1. **Curto prazo:** o script de export no backend gera `criticalSymptoms` global + `checkInRules` apenas; o teste Python compara só esse subconjunto com `PROTOCOL_RULES` (paridade parcial documentada).
2. **Médio prazo:** refatorar templates para sintomas por estágio **ou** derivar estágios no export a partir da mesma fonte que o `protocol_engine` usará após unificação.

### 3.3 Teste pytest (especificação)

1. Carregar `clinical-protocol-snapshot.v1.json` (fixture commitada ou gerada no job).
2. Importar `PROTOCOL_RULES`, `ESAS_ALERT_THRESHOLD`, `ESAS_TOTAL_ALERT`, `PRO_CTCAE_ALERT_GRADE` de `protocol_engine` (e thresholds do questionário após unificação).
3. Assert: para cada `cancerType` no snapshot, `checkInRules` ↔ `PROTOCOL_RULES[cancerType].stages` (frequency + questionnaire).
4. Assert: listas de sintomas por estágio — **quando** o snapshot incluir chaves por estágio — normalização: lowercase, trim, ordenação para comparação.
5. Assert: `thresholds` numéricos iguais entre snapshot e módulo único de constantes (após refatoração `clinical_thresholds.py`).

Esqueleto implementado em [`ai-service/tests/test_protocol_rules_contract.py`](../../ai-service/tests/test_protocol_rules_contract.py) (`pytest.mark.skip` até existir `shared/clinical-protocol-snapshot.v1.json` na raiz do monorepo).

### 3.4 Teste Jest (backend) — gerador

- Função `buildProtocolSnapshot()` em teste ou script `backend/scripts/export-protocol-snapshot.ts` que importa `PROTOCOL_TEMPLATES` / templates e grava JSON.
- Snapshot test: hash ou comparação profunda do JSON esperado.

---

## 4. Backlog de consolidação (prioridade e dono)

| # | Item | Prioridade | Dono sugerido |
|---|------|------------|----------------|
| 1 | Extrair `clinical_thresholds.py` (ESAS/PRO-CTCAE) e importar em `protocol_engine` + `questionnaire_engine` | P0 | ai-service |
| 2 | Alinhar prompt (`_get_symptom_detection_rules`) aos limiares de `clinical_rules.py` (dor 9+, SpO2, ECOG) | P0 | llm-context-engineer + clinical-domain |
| 3 | Corrigir tipos `getStepsByStage` / `initializeSteps` para incluir `PALLIATIVE` onde o backend aceita | P1 | frontend-nextjs |
| 4 | Unificar `createMissingStepsForStage` tipo de retorno entre clientes ou normalizar no hook | P2 | frontend-nextjs |
| 5 | Consolidar `navigationApi` vs `oncologyNavigationApi` (um módulo + reexport) | P2 | frontend-nextjs |
| 6 | Script de export JSON + teste de contrato pytest | P2 | backend-nestjs + ai-service |
| 7 | Fonte única sintomas críticos (template TS → gera Python ou API read-only) | P3 | architect + backend + ai-service |
| 8 | Atualizar `.cursor/agents/clinical-domain.md` quando regras R01–R23 mudarem | Contínuo | clinical-domain |

---

## 5. Referências de código

- Backend bexiga: `backend/src/clinical-protocols/templates/bladder.protocol.ts`
- Agente: `ai-service/src/agent/protocol_engine.py`
- Regras hard: `ai-service/src/agent/clinical_rules.py`
- Prompt sintomas: `ai-service/src/agent/prompts/system_prompt.py`
- Questionários: `ai-service/src/agent/questionnaire_engine.py`
- Jornada FE: `frontend/src/lib/utils/journey-stage.ts`, `frontend/src/lib/api/oncology-navigation.ts`, `frontend/src/lib/api/navigation.ts`

### Snapshot de contrato (templates ↔ `PROTOCOL_RULES`)

- **Arquivo versionado:** `shared/clinical-protocol-snapshot.v1.json` — contém `version: 1` e `cancerTypes.*.checkInRules` alinhados aos templates NestJS (`PROTOCOL_TEMPLATES`).
- **Regenerar após mudar templates:** na pasta `backend`, `npm run export-protocol-snapshot` (sobrescreve o JSON na raiz do repositório).
- **Teste:** `ai-service/tests/test_protocol_rules_contract.py` — falha se frequências/questionários divergirem de `PROTOCOL_RULES`.
- **CI:** o job `backend` em `.github/workflows/ci.yml` executa o export e `git diff --exit-code` nesse arquivo para impedir merge sem snapshot atualizado.
