# OncoNav — Regras de Negócio e Roadmap de Evolução

> Documento de referência: inventário de regras atuais, workflows com prazos clínicos relativos, análise de lacunas e roadmap priorizado.
>
> **Contexto:** SUS + Privado (multi-tenant) | Legislação: Lei 30 dias (Lei 13.896/2019) e Lei 60 dias (Lei 12.732/2012)
>
> **MVP:** Câncer de bexiga. Demais tipos ocultos via configuração por tenant.

---

## Sumário

1. [Inventário de Regras Atuais](#parte-1--inventário-de-regras-atuais)
2. [Workflows com Prazos Relativos](#parte-2--workflows-com-prazos-relativos)
3. [Análise de Lacunas](#parte-3--análise-de-lacunas-gap-analysis)
4. [Roadmap de Evolução](#parte-4--roadmap-de-evolução-fases-5-12)

---

## PARTE 1 — Inventário de Regras Atuais

### 1.1 Regras Clínicas Determinísticas (R01-R23)

Hierarquia de disposição (severidade crescente):

```
REMOTE_NURSING → SCHEDULED_CONSULT → ADVANCE_CONSULT → ER_DAYS → ER_IMMEDIATE
```

#### ER_IMMEDIATE (11 regras)

| ID | Condição | Razão Clínica |
|----|----------|---------------|
| R01 | Febre ≥38°C + (QT ativa OU D+0 a D+21 pós-QT) | Risco de neutropenia febril na janela de nadir |
| R02 | Febre reportada durante nadir (D+7 a D+14 pós-QT) | Alta probabilidade de neutropenia febril — emergência oncológica |
| R03 | SpO2 < 92% | Hipoxemia — avaliação imediata no PS |
| R04 | Dispneia CRÍTICA | Desconforto respiratório grave |
| R05 | Sangramento ativo grave (HIGH/CRITICAL) OU (qualquer sangramento + anticoagulante) | Risco hemorrágico elevado por anticoagulação |
| R06 | Alteração de consciência / confusão mental / desorientação | Emergência neurológica (possível encefalopatia) |
| R07 | Vômito incoercível + (QT ativa OU D+0 a D+21) | Risco de desidratação + distúrbio eletrolítico |
| R08 | Dor ≥ 9/10 | Dor oncológica severa descontrolada |
| R09 | ECOG delta ≥ 2 (piora) | Deterioração funcional rápida — possível progressão ou complicação |
| R10 | Compressão medular suspeitada (fraqueza MMII, perda controle urinário) | Emergência neurológica — risco de paralisia permanente |
| R11 | Febre ≥38°C + (imunossupressor OU corticosteroide) | Risco de sepse mascarada pela imunossupressão |

#### ER_DAYS (6 regras)

| ID | Condição | Razão Clínica |
|----|----------|---------------|
| R12 | Febre ≥38°C + SEM QT ativa / janela de risco | Febre em paciente sem QT requer avaliação em horas |
| R13 | Sinais de obstrução intestinal (distensão abdominal) | Emergência cirúrgica — avaliação urgente |
| R14 | Diarreia severa | Risco de desidratação/distúrbio eletrolítico |
| R15 | Sintomas TVP/trombose (perna inchada, vermelha, dolorida) | Tromboembolismo venoso |
| R16 | Dor 7-8/10 descontrolada | Dor moderada-alta requer revisão analgésica urgente |
| R17 | Mucosite severa + disfagia (não consegue comer/engolir/beber) | Risco de desidratação + desnutrição |

#### ADVANCE_CONSULT (4 regras)

| ID | Condição | Razão Clínica |
|----|----------|---------------|
| R18 | ECOG delta = +1 (declínio moderado) | Piora funcional leve — revisão oncológica antecipada |
| R19 | Dor 5-6/10 | Analgesia inadequada — ajuste de plano de dor |
| R20 | ≥3 sintomas HIGH/CRITICAL simultaneamente | Alta carga sintomática — revisão de suporte |
| R21 | Anticoagulante + qualquer sangramento (hematúria, equimose) | Verificação urgente de INR/nível de anticoagulação |

#### SCHEDULED_CONSULT (2 regras)

| ID | Condição | Razão Clínica |
|----|----------|---------------|
| R22 | Qualquer sintoma com ação ALERT_NURSING | Sintomas moderados requerem revisão médica agendada |
| R23 | ≥2 sintomas MEDIUM simultaneamente | Carga sintomática moderada — consulta agendada |

### 1.2 Scores Clínicos Validados

#### MASCC Risk Index (Neutropenia Febril)

Score 0-26 (maior = menor risco). **Alto risco: ≤ 20**.

| Variável | Pontuação |
|----------|-----------|
| Gravidade dos sintomas (nenhum/leve=5, moderado=3, grave=0) | 0-5 |
| Hipotensão (PAS ≥90=5, <90=0) | 0-5 |
| Sem DPOC (sim=4, não=0) | 0-4 |
| Tumor sólido OU sem infecção fúngica prévia (sim=4, não=0) | 0-4 |
| Sem desidratação (sim=3, não=0) | 0-3 |
| Ambulatorial no início da febre | 3 |
| Idade < 60 anos (sim=2, não=0) | 0-2 |

#### CISNE Score (NF Estável, Tumores Sólidos)

Score 0-8 (maior = maior risco). Risco: baixo (0), intermediário (1-2), **alto (≥3)**.

| Variável | Pontuação |
|----------|-----------|
| ECOG PS ≥ 2 | 2 |
| Hiperglicemia de estresse (glicose >121 mg/dL sem diabetes) | 2 |
| DPOC | 1 |
| Doença cardiovascular crônica (ICC, DAC, FA) | 1 |
| Mucosite NCI grau ≥ 2 (HIGH/CRITICAL) | 1 |
| Monócitos < 200/µL | 1 |

**Integração:** MASCC alto risco (≤20) pode elevar ER_DAYS → ER_IMMEDIATE. CISNE baixo risco + MASCC baixo risco pode adicionar nota de candidatura ambulatorial.

### 1.3 Modelo ML de Priorização

- **Arquitetura:** LightGBM ordinal classifier, 5 classes = ClinicalDisposition
- **32 features:** demografia, perfil câncer, timing QT (D+N), ECOG, sintomas ESAS, sinais vitais, medicações, comorbidades, MASCC/CISNE, contexto
- **Pesos assimétricos:** sub-triagem penalizada mais (5x para ER_IMMEDIATE)
- **4 camadas:** Regras hard → Scores validados → ML → Modificadores sociais

### 1.4 Workflows de Navegação

- 8 tipos de câncer + paliativo
- 4 estágios: SCREENING → DIAGNOSIS → TREATMENT → FOLLOW_UP (+ PALLIATIVE)
- **Problema atual:** Prazos absolutos (`new Date() + X dias`), sem encadeamento entre etapas

### 1.5 Alertas

- 14+ tipos (NAVIGATION_DELAY, EMERGENCY_DETECTED, CLINICAL_RULES_ALERT, AI_DETECTED_ALERT, etc.)
- 4 severidades: LOW, MEDIUM, HIGH, CRITICAL
- Lifecycle: PENDING → ACKNOWLEDGED → RESOLVED
- WebSocket real-time para dashboard de enfermagem

### 1.6 Decision Gate

**Auto-aprovados:** RESPOND_TO_QUESTION, START_QUESTIONNAIRE, CONTINUE_QUESTIONNAIRE, QUESTIONNAIRE_COMPLETE, RECORD_SYMPTOM, CREATE_ALERT (LOW e HIGH/CRITICAL), SCHEDULE_CHECK_IN, SEND_REMINDER, UPDATE_NAVIGATION_STEP, GREETING_RESPONSE, RECALCULATE_PRIORITY, APPOINTMENT_RESPONSE, PROTOCOL_ALERT, CHECK_IN_SCHEDULED

**Requerem aprovação humana:** CHANGE_TREATMENT_STATUS, RECOMMEND_APPOINTMENT, HANDOFF_TO_SPECIALIST, QUESTIONNAIRE_ESCALATION

**Fallback:** Ações desconhecidas requerem aprovação por segurança.

### 1.7 Segurança e Multi-Tenant

- Toda query inclui `tenantId` (Prisma)
- Roles: ADMIN, ONCOLOGIST, DOCTOR, NURSE_CHIEF, NURSE, COORDINATOR
- Rate limiting: 10 req/min auth, 100 req/min geral, 200 req/min webhook
- Lockout: 5 tentativas → 15 min bloqueio
- Refresh token rotation, 7 dias TTL

---

## PARTE 2 — Workflows com Prazos Relativos

Cada etapa define prazo relativo à **conclusão da etapa anterior** (ou etapa de referência específica). O sistema deve recalcular `dueDate` das etapas seguintes quando uma etapa é concluída.

### Estratégia MVP: Visibilidade por Tipo de Câncer

| Tipo de Câncer | Status MVP | Observação |
|----------------|-----------|------------|
| **Bexiga** | **ATIVO** | Tipo principal do MVP |
| Colorretal | OCULTO | Ativável por configuração do tenant |
| Mama | OCULTO | Ativável por configuração do tenant |
| Pulmão | OCULTO | Ativável por configuração do tenant |
| Próstata | OCULTO | Ativável por configuração do tenant |
| Rim | OCULTO | Ativável por configuração do tenant |
| Testículo | OCULTO | Ativável por configuração do tenant |
| Genérico | OCULTO | Ativável por configuração do tenant |

**Mecanismo:** Flag `enabledCancerTypes` por tenant (array de `CancerType`). Default MVP: `['BLADDER']`. Frontend filtra tipos desabilitados. Backend valida na criação de paciente/diagnóstico.

### Estágios da Jornada (Journey Stages)

| Estágio | Descrição |
|---------|-----------|
| SCREENING | Rastreio e exames iniciais |
| DIAGNOSIS | Confirmação diagnóstica e estadiamento |
| TREATMENT | Tratamento cirúrgico, QT, RT, imunoterapia |
| FOLLOW_UP | Seguimento pós-tratamento |
| **PALLIATIVE** | **Cuidados paliativos — conforto, suporte, qualidade de vida. Transversal a qualquer tipo de câncer.** |

### Regras Gerais de Prazo

- **Lei dos 30 dias** (Lei 13.896/2019): Da suspeita à confirmação diagnóstica (laudo patológico) ≤ 30 dias
- **Lei dos 60 dias** (Lei 12.732/2012): Do diagnóstico ao primeiro tratamento ≤ 60 dias
- **Laudo patológico**: Rotina ≤ 7 dias (meta CAP: 2 dias úteis, 90% dos casos)
- **QT adjuvante**: Iniciar em 6-8 semanas pós-cirurgia; além de 12 semanas piora sobrevida
- **RT pós-cirurgia**: 6-8 semanas; não exceder 20-24 semanas se houver QT antes

---

### CÂNCER DE BEXIGA — MVP ATIVO

| # | Etapa | Código | Prazo Relativo | Referência | Obrigatória | Estágio |
|---|-------|--------|---------------|------------|-------------|---------|
| 1 | Citologia Urinária | `urine_cytology` | T+0 (início) | — | Sim | SCREENING |
| 2 | Cistoscopia | `cystoscopy` | T+14-21 dias após #1 | EAU/AUA | Sim | DIAGNOSIS |
| 3 | RTU de Bexiga | `transurethral_resection` | T+14-21 dias após #2 (ou simultâneo) | EAU | Sim | DIAGNOSIS |
| 4 | Laudo Anatomopatológico | `pathology_report` | T+7 dias após #3 | CAP | Sim | DIAGNOSIS |
| 5 | Urografia por TC | `ct_urography` | T+14 dias após #4 | EAU/NCCN | Sim | DIAGNOSIS |
| 6 | TC de Tórax | `ct_thorax` | T+0 dias (paralelo a #5) | NCCN | Sim | DIAGNOSIS |
| 7 | BCG Intravesical | `intravesical_bcg` | T+14-42 dias após #3 (NMIBC, indução 6 sem) | EAU | Não | TREATMENT |
| 8 | Cistectomia Radical | `radical_cystectomy` | T+30-42 dias após #4 (MIBC) | EAU/NCCN | Não | TREATMENT |
| 9 | Neobexiga ou Urostomia | `neobladder_or_urostomy` | T+0 dias (simultâneo a #8) | — | Não | TREATMENT |
| 10 | Quimioterapia | `chemotherapy` | T+30 dias após #4 (neoadj MIBC) ou T+42 dias após #8 (adj) | NCCN | Não | TREATMENT |
| 11 | Cistoscopia 3 meses | `cystoscopy_3months` | T+90 dias após #7 ou #8 | EAU/NCCN | Sim | FOLLOW_UP |
| 12 | Cistoscopia 6 meses | `cystoscopy_6months` | T+180 dias após #7 ou #8 | NCCN | Sim | FOLLOW_UP |
| 13 | Cistoscopia Anual | `cystoscopy_annual` | T+365 dias após #7 ou #8 | NCCN | Sim | FOLLOW_UP |

**Checkpoint legal:** #4 ≤ 30 dias após suspeita (Lei 30 dias). #7 ou #8 ≤ 60 dias após #4 (Lei 60 dias).

**Regras de bifurcação (NMIBC vs MIBC):**
- Laudo (#4) indica **NMIBC** (não-músculo-invasivo) → pathway BCG (#7) → follow-up cistoscopia
- Laudo (#4) indica **MIBC** (músculo-invasivo) → pathway QT neoadjuvante (#10) → cistectomia (#8) → follow-up
- Etapas não-aplicáveis marcadas como `NOT_APPLICABLE` com base no estadiamento patológico

---

### ESTÁGIO PALLIATIVE — Cuidados Paliativos (transversal)

T+0 = data de transição para cuidados paliativos. Ativado para qualquer tipo de câncer.

| # | Etapa | Código | Prazo Relativo | Referência | Obrigatória |
|---|-------|--------|---------------|------------|-------------|
| P1 | Cuidados de Conforto | `palliative_comfort_care` | T+0 (início imediato) | ASCO | Sim |
| P2 | Avaliação de Sintomas | `palliative_symptom_assessment` | T+3-7 dias após P1 | ASCO | Sim |
| P3 | Revisão de Medicação | `palliative_medication_review` | T+0 dias (paralelo a P2) | ASCO | Sim |
| P4 | Avaliação de Qualidade de Vida | `palliative_quality_of_life_assessment` | T+7 dias após P2 | ASCO | Sim |
| P5 | Avaliação Suporte Familiar | `palliative_family_support_assessment` | T+7 dias após P1 | ASCO | Sim |
| P6 | Coordenação Equipe Multidisciplinar | `palliative_multidisciplinary_team` | T+14 dias após P1 | ASCO | Sim |
| P7 | Avaliação Nutricional | `palliative_nutritional_assessment` | T+14 dias após P1 | — | Sim |
| P8 | Planejamento Cuidados Avançados | `palliative_advance_care_planning` | T+30 dias após P1 | ASCO | Não |
| P9 | Avaliação Espiritual | `palliative_spiritual_support` | T+30 dias após P1 | NCCN | Não |

**Regras de transição:** Ao entrar no estágio PALLIATIVE, etapas pendentes de estágios anteriores (TREATMENT, FOLLOW_UP) podem ser marcadas como `NOT_APPLICABLE` ou mantidas conforme decisão clínica.

---

> **Os workflows abaixo estão OCULTOS no MVP** (código preservado, ativável por `enabledCancerTypes` do tenant)

---

### CÂNCER COLORRETAL — OCULTO no MVP

| # | Etapa | Código | Prazo Relativo | Referência | Obrigatória | Estágio |
|---|-------|--------|---------------|------------|-------------|---------|
| 1 | Pesquisa de Sangue Oculto nas Fezes | `fecal_occult_blood` | T+0 (início) | — | Sim | SCREENING |
| 2 | Colonoscopia de Rastreio | `colonoscopy` | T+30 dias após #1 | INCA/NCCN | Não | SCREENING |
| 3 | Colonoscopia com Biópsia | `colonoscopy_with_biopsy` | T+14 dias após #1 (se FOBT+) ou T+0 (se colonoscopia já indicada) | Lei 30 dias | Sim | DIAGNOSIS |
| 4 | Laudo Anatomopatológico | `pathology_report` | T+7 dias após #3 | CAP/CONITEC | Sim | DIAGNOSIS |
| 5 | TC de Abdome e Pelve | `staging_ct_abdomen` | T+14 dias após #4 | NCCN | Sim | DIAGNOSIS |
| 6 | TC de Tórax | `staging_ct_thorax` | T+0 dias (paralelo a #5) | NCCN | Sim | DIAGNOSIS |
| 7 | Teste Genético (MSI, KRAS, NRAS, BRAF) | `genetic_testing` | T+14 dias após #4 (paralelo a #5) | NCCN/ESMO | Não | DIAGNOSIS |
| 8 | CEA Basal | `cea_baseline` | T+0 dias (paralelo a #5) | NCCN | Sim | DIAGNOSIS |
| 9 | Avaliação Cirúrgica | `surgical_evaluation` | T+14 dias após #5 | Lei 60 dias | Sim | TREATMENT |
| 10 | Colectomia (Cirurgia) | `colectomy` | T+21-30 dias após #9 | Lei 60 dias / NCCN | Sim | TREATMENT |
| 11 | Quimioterapia Adjuvante | `adjuvant_chemotherapy` | T+42-56 dias após #10 (6-8 sem pós-cx) | ASCO/NCCN | Não | TREATMENT |
| 12 | Radioterapia | `radiotherapy` | T+42-56 dias após #10 (se indicada) | NCCN | Não | TREATMENT |
| 13 | CEA aos 3 meses | `cea_3months` | T+90 dias após #10 | NCCN | Sim | FOLLOW_UP |
| 14 | Colonoscopia de Controle (1 ano) | `colonoscopy_1year` | T+365 dias após #10 | NCCN | Sim | FOLLOW_UP |
| 15 | TC Abdome/Pelve Anual | `ct_abdomen_annual` | T+365 dias após #10 | NCCN | Sim | FOLLOW_UP |
| 16 | Colonoscopia de Controle (3 anos) | `colonoscopy_3years` | T+1095 dias após #10 | NCCN | Sim | FOLLOW_UP |

**Checkpoint legal:** #4 ≤ 30 dias após suspeita. #10 ≤ 60 dias após #4.

---

### CÂNCER DE MAMA — OCULTO no MVP

| # | Etapa | Código | Prazo Relativo | Referência | Obrigatória | Estágio |
|---|-------|--------|---------------|------------|-------------|---------|
| 1 | Mamografia | `mammography` | T+0 (início) | — | Sim | SCREENING |
| 2 | USG de Mama | `breast_ultrasound` | T+14 dias após #1 | INCA | Não | SCREENING |
| 3 | Biópsia de Mama | `breast_biopsy` | T+14 dias após #2 (ou #1) | Lei 30 dias | Sim | DIAGNOSIS |
| 4 | Laudo Anatomopatológico | `pathology_report` | T+7 dias após #3 | CAP | Sim | DIAGNOSIS |
| 5 | RM de Mama | `breast_mri` | T+14 dias após #4 | NCCN | Não | DIAGNOSIS |
| 6 | TC Tórax, Abdome e Pelve | `staging_ct_thorax_abdomen` | T+14 dias após #4 | NCCN/ESMO | Sim | DIAGNOSIS |
| 7 | Cintilografia Óssea | `bone_scan` | T+0 dias (paralelo a #6) | NCCN | Não | DIAGNOSIS |
| 8 | Aconselhamento Genético | `genetic_counseling` | T+14-30 dias após #4 | NCCN | Não | DIAGNOSIS |
| 9 | Avaliação Cirúrgica | `surgical_evaluation` | T+14 dias após #6 | Lei 60 dias | Sim | TREATMENT |
| 10 | QT Neoadjuvante | `neoadjuvant_chemotherapy` | T+14-21 dias após #9 (se indicada, duração 120-180 dias) | NCCN/ESMO | Não | TREATMENT |
| 11 | Mastectomia ou Quadrantectomia | `mastectomy_or_lumpectomy` | T+14-35 dias após #10 (ou T+30-42 dias após #9 se sem neo) | NCCN | Sim | TREATMENT |
| 12 | Biópsia Linfonodo Sentinela | `sentinel_lymph_node` | T+0 dias (simultâneo a #11) | NCCN | Sim | TREATMENT |
| 13 | QT Adjuvante | `adjuvant_chemotherapy` | T+28-56 dias após #11 (4-8 sem pós-cx) | ASCO | Não | TREATMENT |
| 14 | Radioterapia | `radiotherapy` | T+42-56 dias após #11 (ou após #13 se houver QT adj) | NCCN | Não | TREATMENT |
| 15 | Hormonioterapia | `hormonal_therapy` | T+0-14 dias após #14 (ou após #13 se sem RT) | NCCN | Não | TREATMENT |
| 16 | Terapia Alvo (Trastuzumab) | `targeted_therapy` | T+0 dias (paralelo a #13, se HER2+) | NCCN | Não | TREATMENT |
| 17 | Mamografia 6 meses | `mammography_6months` | T+180 dias após #11 | NCCN | Sim | FOLLOW_UP |
| 18 | Mamografia Anual | `mammography_annual` | T+365 dias após #11 | NCCN | Sim | FOLLOW_UP |
| 19 | Exame Clínico 6 meses | `clinical_exam_6months` | T+180 dias após #11 | NCCN | Sim | FOLLOW_UP |

**Checkpoint legal:** #4 ≤ 30 dias após suspeita. #11 ≤ 60 dias após #4 (ou início de #10 se neoadjuvante conta como 1º tratamento).

---

### CÂNCER DE PULMÃO — OCULTO no MVP

| # | Etapa | Código | Prazo Relativo | Referência | Obrigatória | Estágio |
|---|-------|--------|---------------|------------|-------------|---------|
| 1 | TC Tórax Baixa Dose | `low_dose_ct` | T+0 (início) | NCCN | Sim | SCREENING |
| 2 | TC Tórax com Contraste | `ct_thorax_contrast` | T+14 dias após #1 | NICE NG122 | Sim | DIAGNOSIS |
| 3 | Broncoscopia com Biópsia | `bronchoscopy_biopsy` | T+14 dias após #2 | NCCN | Sim | DIAGNOSIS |
| 4 | Laudo Anatomopatológico | `pathology_report` | T+7 dias após #3 | CAP | Sim | DIAGNOSIS |
| 5 | PET-CT | `pet_ct` | T+14 dias após #4 | NCCN | Sim | DIAGNOSIS |
| 6 | Testes Moleculares (EGFR, ALK, ROS1, PD-L1) | `molecular_testing` | T+14 dias após #4 (paralelo a #5) | NCCN/IASLC | Sim | DIAGNOSIS |
| 7 | RM de Crânio | `brain_mri` | T+14 dias após #4 (paralelo a #5) | NCCN | Não | DIAGNOSIS |
| 8 | Avaliação Cirúrgica | `surgical_evaluation` | T+14 dias após #5 e #6 | Lei 60 dias | Não | TREATMENT |
| 9 | Lobectomia ou Pneumonectomia | `lobectomy_or_pneumonectomy` | T+21-42 dias após #8 | NCCN | Não | TREATMENT |
| 10 | Quimioterapia | `chemotherapy` | T+42-56 dias após #9 (ou T+21 dias após #5 se inoperável) | NCCN | Não | TREATMENT |
| 11 | Radioterapia | `radiotherapy` | T+0 dias (concomitante a #10) | NCCN | Não | TREATMENT |
| 12 | Terapia Alvo | `targeted_therapy` | T+21 dias após #6 (se mutação) | NCCN | Não | TREATMENT |
| 13 | Imunoterapia | `immunotherapy` | T+21 dias após #6 (se PD-L1+) | NCCN | Não | TREATMENT |
| 14 | TC Tórax 3 meses | `ct_thorax_3months` | T+90 dias após início tratamento | NCCN | Sim | FOLLOW_UP |
| 15 | TC Tórax 6 meses | `ct_thorax_6months` | T+180 dias após início tratamento | NCCN | Sim | FOLLOW_UP |
| 16 | TC Tórax Anual | `ct_thorax_annual` | T+365 dias após início tratamento | NCCN | Sim | FOLLOW_UP |

---

### CÂNCER DE PRÓSTATA — OCULTO no MVP

| # | Etapa | Código | Prazo Relativo | Referência | Obrigatória | Estágio |
|---|-------|--------|---------------|------------|-------------|---------|
| 1 | Dosagem de PSA | `psa_test` | T+0 (início) | — | Sim | SCREENING |
| 2 | Toque Retal | `digital_rectal_exam` | T+0 dias (simultâneo a #1) | EAU/CONITEC | Sim | SCREENING |
| 3 | RM Multiparamétrica | `prostate_mri` | T+30 dias após #1 (se PSA alterado) | EAU/NCCN | Não | DIAGNOSIS |
| 4 | Biópsia de Próstata | `prostate_biopsy` | T+14-30 dias após #3 (ou #1 se sem RM) | Lei 30 dias | Sim | DIAGNOSIS |
| 5 | Laudo Anatomopatológico | `pathology_report` | T+7 dias após #4 | CAP | Sim | DIAGNOSIS |
| 6 | Cintilografia Óssea | `bone_scan` | T+14-21 dias após #5 (se Gleason ≥7 ou PSA >20) | EAU/NCCN | Não | DIAGNOSIS |
| 7 | TC de Abdome e Pelve | `ct_abdomen_pelvis` | T+0 dias (paralelo a #6) | NCCN | Não | DIAGNOSIS |
| 8 | Decisão de Tratamento | `treatment_decision` | T+14-30 dias após #5 | Lei 60 dias | Sim | TREATMENT |
| 9 | Prostatectomia Radical | `radical_prostatectomy` | T+30-42 dias após #8 | NCCN | Não | TREATMENT |
| 10 | Radioterapia | `radiotherapy` | T+30-42 dias após #8 (alternativa a #9) | NCCN | Não | TREATMENT |
| 11 | Hormonioterapia | `hormonal_therapy` | T+0-14 dias após #8 | NCCN | Não | TREATMENT |
| 12 | PSA 3 meses | `psa_3months` | T+42-90 dias após #9 ou #10 | EAU/NCCN | Sim | FOLLOW_UP |
| 13 | PSA 6 meses | `psa_6months` | T+180 dias após #9 ou #10 | NCCN | Sim | FOLLOW_UP |
| 14 | PSA Anual | `psa_annual` | T+365 dias após #9 ou #10 | NCCN | Sim | FOLLOW_UP |

---

### CÂNCER DE RIM — OCULTO no MVP

| # | Etapa | Código | Prazo Relativo | Referência | Obrigatória | Estágio |
|---|-------|--------|---------------|------------|-------------|---------|
| 1 | USG de Abdome | `abdominal_ultrasound` | T+0 (início) | — | Sim | SCREENING |
| 2 | TC de Abdome com Contraste | `ct_abdomen_contrast` | T+14-21 dias após #1 | EAU/NCCN | Sim | DIAGNOSIS |
| 3 | Biópsia ou Cirurgia Diagnóstica | `biopsy_or_surgery` | T+14-21 dias após #2 | EAU | Sim | DIAGNOSIS |
| 4 | Laudo Anatomopatológico | `pathology_report` | T+7 dias após #3 | CAP | Sim | DIAGNOSIS |
| 5 | TC de Tórax | `ct_thorax` | T+0 dias (paralelo a #2) | NCCN | Sim | DIAGNOSIS |
| 6 | Cintilografia Óssea | `bone_scan` | T+14 dias após #4 (se sintomas ósseos) | NCCN | Não | DIAGNOSIS |
| 7 | Avaliação Cirúrgica | `surgical_evaluation` | T+14 dias após #4 | Lei 60 dias | Sim | TREATMENT |
| 8 | Nefrectomia Parcial ou Radical | `partial_or_radical_nephrectomy` | T+30-42 dias após #7 | EAU/NCCN | Sim | TREATMENT |
| 9 | Terapia Alvo | `targeted_therapy` | T+28-42 dias após #8 | NCCN | Não | TREATMENT |
| 10 | Imunoterapia | `immunotherapy` | T+28-42 dias após #8 | NCCN | Não | TREATMENT |
| 11 | TC Abdome 3 meses | `ct_abdomen_3months` | T+90 dias após #8 | NCCN | Sim | FOLLOW_UP |
| 12 | TC Abdome 6 meses | `ct_abdomen_6months` | T+180 dias após #8 | NCCN | Sim | FOLLOW_UP |
| 13 | TC Abdome Anual | `ct_abdomen_annual` | T+365 dias após #8 | NCCN | Sim | FOLLOW_UP |

---

### CÂNCER DE TESTÍCULO — OCULTO no MVP (Urgência)

| # | Etapa | Código | Prazo Relativo | Referência | Obrigatória | Estágio |
|---|-------|--------|---------------|------------|-------------|---------|
| 1 | USG de Testículo | `testicular_ultrasound` | T+0 (início, URGENTE) | EAU/AUA | Sim | SCREENING |
| 2 | Orquiectomia Radical | `radical_orchiectomy` | T+7-14 dias após #1 (URGENTE) | EAU/NCCN | Sim | DIAGNOSIS |
| 3 | Laudo Anatomopatológico | `pathology_report` | T+7 dias após #2 | CAP | Sim | DIAGNOSIS |
| 4 | Marcadores Tumorais (AFP, HCG, LDH) | `tumor_markers` | T+5-7 dias após #2 (paralelo a #3) | EAU | Sim | DIAGNOSIS |
| 5 | TC de Abdome e Pelve | `ct_abdomen_pelvis` | T+7-14 dias após #2 (paralelo a #3) | NCCN | Sim | DIAGNOSIS |
| 6 | TC de Tórax | `ct_thorax` | T+0 dias (paralelo a #5) | NCCN | Sim | DIAGNOSIS |
| 7 | Linfadenectomia Retroperitoneal | `retroperitoneal_lymph_node_dissection` | T+14-28 dias após #3 e #4 (se estádio II) | EAU/AUA | Não | TREATMENT |
| 8 | Quimioterapia | `chemotherapy` | T+7-21 dias após #3 e #4 | NCCN | Não | TREATMENT |
| 9 | Radioterapia | `radiotherapy` | T+14-28 dias após #3 (seminoma estádio II) | EAU | Não | TREATMENT |
| 10 | Marcadores 1 mês | `tumor_markers_1month` | T+30 dias após #7/#8/#9 | EAU | Sim | FOLLOW_UP |
| 11 | TC Abdome 3 meses | `ct_abdomen_3months` | T+90 dias após #7/#8/#9 | NCCN | Sim | FOLLOW_UP |
| 12 | TC Abdome 6 meses | `ct_abdomen_6months` | T+180 dias após #7/#8/#9 | NCCN | Sim | FOLLOW_UP |
| 13 | TC Abdome Anual | `ct_abdomen_annual` | T+365 dias após #7/#8/#9 | NCCN | Sim | FOLLOW_UP |

---

## PARTE 3 — Análise de Lacunas (Gap Analysis)

Comparação com padrões internacionais (AONN+, NCCN, ASCO, ESMO, CoC).

### Criticidade ALTA (impacto clínico direto)

1. **Emergências oncológicas faltantes** — 12 novas regras propostas (R24-R35)
2. **Triagem de Distress NCCN** — "6º sinal vital", obrigatório para acreditação CoC
3. **Monitoramento remoto proativo (RPM)** — pesquisas semanais via WhatsApp, melhora sobrevida comprovada

### Criticidade MÉDIA (qualidade da navegação)

4. **Rastreamento de barreiras do paciente** — 10 categorias PN-BOT (financeira, transporte, psicossocial, etc.)
5. **Métricas de navegação AONN+** — 8 domínios, 35 métricas adaptadas
6. **Toxicidade financeira (Score COST)** — diretriz ESMO 2024

### Criticidade BAIXA (melhorias incrementais)

7. Avaliação geriátrica oncológica (≥65 anos) — guideline ASCO 2025
8. Karnofsky Performance Status complementar ao ECOG
9. Documentação estruturada de navegação + exportação para prontuário
10. Algoritmos expandidos de manejo de sintomas (recomendações farmacológicas/não-farmacológicas)

---

## PARTE 4 — Roadmap de Evolução (Fases 5-12)

### Fase 5: Emergências Oncológicas Expandidas

**Novas regras propostas:**

| ID | Condição | Disposição | Referência |
|----|----------|------------|------------|
| R24 | Síndrome da veia cava superior (edema facial + distensão jugular + dispneia progressiva) | ER_IMMEDIATE | NCCN |
| R25 | Tamponamento cardíaco (hipotensão + jugular distendida + abafamento de bulhas) | ER_IMMEDIATE | NCCN |
| R26 | Hipercalcemia maligna grave (Ca >14 mg/dL OU confusão + náusea + poliúria + arritmia) | ER_IMMEDIATE | ESMO |
| R27 | Síndrome de lise tumoral (hiperuricemia + hipercalemia + hiperfosfatemia + hipocalcemia) | ER_IMMEDIATE | ASCO |
| R28 | CIVD (sangramento difuso + petéquias + equimoses extensas) | ER_IMMEDIATE | — |
| R29 | Obstrução de vias aéreas (estridor + dispneia grave, tumor cabeça/pescoço) | ER_IMMEDIATE | NCCN |
| R30 | ≥2 critérios SIRS + imunossuprimido | ER_IMMEDIATE | Sepsis-3 |
| R31 | Hipercalcemia moderada (Ca 12-14 mg/dL) + sintomas leves | ER_DAYS | ESMO |
| R32 | Derrame pleural maligno sintomático | ER_DAYS | — |
| R33 | Retenção urinária aguda (tumor pélvico) | ER_DAYS | — |
| R34 | Fratura patológica (dor óssea + incapacidade + metástase óssea) | ER_IMMEDIATE | NCCN |
| R35 | Hipertensão intracraniana (cefaleia + vômitos em jato + déficit focal) | ER_IMMEDIATE | — |

**Etapas de implementação:**

| Etapa | Descrição | Prazo Relativo |
|-------|-----------|---------------|
| 5.1 | Levantamento clínico — validar condições detectáveis via relato WhatsApp vs dados estruturados | T+0 |
| 5.2 | Especificação das regras (keywords PT-BR, thresholds, disposição, reasoning) | T+2d após 5.1 |
| 5.3 | Modelo de dados — novos campos no ClinicalContext (FC, FR, labs expandidos), migration | T+2d após 5.2 |
| 5.4 | Implementação em `clinical_rules.py` (R24-R35) | T+3d após 5.3 |
| 5.5 | Atualização do `context_builder.py` | T+1d após 5.4 |
| 5.6 | Testes unitários (positivo, negativo, edge case, interação com R01-R23) | T+2d após 5.5 |
| 5.7 | Retreino ML com cenários expandidos | T+2d após 5.6 |
| 5.8 | Validação clínica com casos simulados | T+3d após 5.7 |

---

### Fase 6: Triagem de Distress + Rastreamento de Barreiras

**Etapas de implementação:**

| Etapa | Descrição | Prazo Relativo |
|-------|-----------|---------------|
| 6.1 | Especificação Termômetro Distress NCCN (escala 0-10 + 5 categorias) para WhatsApp | T+0 |
| 6.2 | Especificação modelo de Barreiras (10 categorias PN-BOT, lifecycle, intervenções) | T+2d após 6.1 |
| 6.3 | Modelos Prisma (`DistressScreening`, `PatientBarrier`), enums, migration | T+2d após 6.2 |
| 6.4 | Módulo NestJS `distress-screening` (CRUD, agendamento próxima triagem) | T+3d após 6.3 |
| 6.5 | Módulo NestJS `patient-barriers` (CRUD, stats por categoria) — paralelo a 6.4 | T+2d após 6.3 |
| 6.6 | Integração orquestrador: questionário distress via WhatsApp + detecção automática de barreiras | T+3d após 6.4 e 6.5 |
| 6.7 | Regras de alerta: distress ≥4, piora ≥3 pontos, barreira não resolvida | T+2d após 6.6 |
| 6.8 | Frontend: tela distress + barreiras no dashboard — paralelo a 6.6 | T+4d após 6.5 |
| 6.9 | Testes unitários e e2e | T+3d após 6.7 e 6.8 |
| 6.10 | Configuração por tenant (frequência, thresholds, categorias ativas) | T+2d após 6.9 |

---

### Fase 7: Framework de Métricas AONN+ (Adaptado Brasil)

**8 domínios, 35 métricas adaptadas:**

| Domínio | Métricas Principais |
|---------|-------------------|
| 1. Desempenho Operacional | Tempo suspeita→diagnóstico, diagnóstico→tratamento, nº navegados, compliance Lei 30/60 dias |
| 2. Barreiras | Identificadas, resolvidas, taxa resolução, tempo médio, top 5 |
| 3. Desfechos Clínicos | Adesão tratamento, emergências evitáveis, readmissões |
| 4. Experiência do Paciente | Satisfação, tempo resposta agente, resolução 1ª interação |
| 5. Triagem Psicossocial | % distress screening, % score ≥4, encaminhamentos |
| 6. Qualidade de Navegação | Steps em dia vs atrasados, completude plano |
| 7. Conformidade | Aderência protocolos CONITEC, compliance Lei 30/60d |
| 8. ROI | Custo/paciente navegado, emergências evitadas, economia |

**Etapas de implementação:**

| Etapa | Descrição | Prazo Relativo |
|-------|-----------|---------------|
| 7.1 | Especificação dos 8 domínios (fórmula, fonte de dados, frequência) | T+0 (após Fase 6.3) |
| 7.2 | Modelo Prisma (`NavigationMetric`, `MetricSnapshot`), migration — paralelo a 7.3 | T+2d após 7.1 |
| 7.3 | Domínios 1-2: Desempenho Operacional + Barreiras | T+3d após 7.1 |
| 7.4 | Domínios 3-4: Desfechos Clínicos + Experiência Paciente | T+3d após 7.3 |
| 7.5 | Domínios 5-6: Triagem Psicossocial + Qualidade Navegação | T+2d após 7.4 |
| 7.6 | Domínios 7-8: Conformidade + ROI | T+2d após 7.5 |
| 7.7 | Serviço de cálculo + scheduler (job diário/semanal configurável) | T+3d após 7.6 e 7.2 |
| 7.8 | Dashboard frontend (visão geral, drill-down, gráficos, exportação) | T+5d após 7.7 |
| 7.9 | Configuração por tenant (métricas ativas, metas, alertas de meta) | T+3d após 7.8 |
| 7.10 | Testes + validação com dados seed | T+3d após 7.9 |

---

### Fases Futuras (Backlog Priorizado)

| Fase | Descrição | Pré-requisito | Estimativa |
|------|-----------|---------------|------------|
| 8 | RPM via WhatsApp (pesquisas semanais automatizadas) | Fases 5-6 | ~15d |
| 9 | Score COST (Toxicidade Financeira) | Fase 6 | ~10d |
| 10 | Avaliação Geriátrica Oncológica (≥65 anos) | Fase 6 | ~12d |
| 11 | Algoritmos Expandidos de Manejo de Sintomas | Fase 5 | ~20d |
| 12 | Documentação Estruturada + Exportação Prontuário | Fase 7 | ~15d |

---

## Referências

- **NCCN** — Clinical Practice Guidelines (por tipo de câncer + Distress Management + Supportive Care)
- **ASCO/IDSA** — Manejo de Neutropenia Febril
- **ESMO** — Neutropenia Febril + Toxicidade Financeira + PRO em Prática Clínica
- **EAU** — Guidelines de Urologia (Bexiga, Próstata, Rim, Testículo)
- **AUA** — Guidelines de Urologia
- **AONN+/ONS** — 19 Padrões de Prática Profissional de Navegação + 35 Métricas
- **CAP** — Turnaround Time para Biópsias
- **CONITEC** — Protocolos Clínicos e Diretrizes Terapêuticas
- **INCA** — Detecção Precoce do Câncer
- **Lei 12.732/2012** — 60 dias diagnóstico→tratamento
- **Lei 13.896/2019** — 30 dias suspeita→diagnóstico
- **CoC** — Commission on Cancer Standards (Distress Screening, Navigation Process)
- **PRO-CTCAE** — Patient-Reported Outcomes NCI
- **PN-BOT** — Patient Navigation Barriers and Outcomes Tool (GW Cancer Center)
- **MASCC** — Multinational Association for Supportive Care in Cancer Risk Index
- **CISNE** — Clinical Index of Stable Febrile Neutropenia
