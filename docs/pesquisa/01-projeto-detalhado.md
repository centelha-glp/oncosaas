# PROJETO DE PESQUISA

---

## CAPA

**Titulo do Projeto:**  
OncoNav: Plataforma Digital de Navegacao Oncologica com Inteligencia Artificial como Apoio a Decisao Clinica — Estudo Misto de Validacao e Avaliação

**Instituicao Proponente:**
Hospital Universitario Cassiano Antonio Moraes (HUCAM)
Universidade Federal do Espirito Santo (UFES)
Rede EBSERH

**Pesquisador Principal (Orientador):**
[NOME DO PESQUISADOR PRINCIPAL — PREENCHER]
[TITULACAO — PREENCHER]
[CRM/COREN — PREENCHER]
[E-MAIL INSTITUCIONAL — PREENCHER]
[TELEFONE — PREENCHER]

**Pesquisador Associado:**
[NOME DO PESQUISADOR ASSOCIADO — PREENCHER]
[TITULACAO — PREENCHER]
[E-MAIL INSTITUCIONAL — PREENCHER]
[TELEFONE — PREENCHER]

**Local de Realizacao:**
Servico de Oncologia / Urologia — HUCAM/UFES
Av. Marechal Campos, 1468 — Maruipe, Vitoria/ES — CEP 29043-900

**Data de Elaboracao:** [PREENCHER — MES/ANO]

**Versao:** 1.0

---

## 1. RESUMO

### 1.1 Resumo em Portugues

A navegacao oncologica e uma estrategia assistencial que visa reduzir barreiras ao diagnostico e tratamento do cancer, promovendo a coordenacao do cuidado e a melhoria de desfechos clinicos. Apesar de evidencias internacionais robustas sobre seus beneficios, a implementacao de programas de navegacao no Sistema Unico de Saude (SUS) permanece incipiente, limitada pela escassez de recursos humanos e pela fragmentacao da rede de atencao oncologica. O presente projeto propoe o desenvolvimento, validacao tecnica e avaliacao clinica da plataforma OncoNav, um sistema digital de navegacao oncologica que integra inteligencia artificial (IA) como ferramenta de apoio a decisao clinica. A plataforma utiliza um agente conversacional via WhatsApp Business API para monitoramento ativo de pacientes, um modelo de aprendizado de maquina (LightGBM) com 32 variaveis clinicas para estratificacao de risco em cinco niveis de disposicao clinica, alem de 23 regras deterministicas baseadas em protocolos oncologicos validados e scores clinicos reconhecidos (MASCC e CISNE). Trata-se de estudo misto em duas fases: Fase 1 — validacao tecnica da plataforma, incluindo acuracia do modelo de priorizacao, sensibilidade e especificidade das regras clinicas, e avaliacao de usabilidade; Fase 2 — coorte observacional prospectiva com pacientes adultos com cancer de bexiga em acompanhamento no HUCAM/UFES, avaliando desfechos como tempo ate diagnostico, adesao ao tratamento, visitas evitaveis a emergencia e satisfacao do paciente. A IA opera exclusivamente como ferramenta de apoio, sendo todas as decisoes clinicas validadas por profissionais de saude. O estudo visa contribuir para a construcao de evidencias sobre o uso de tecnologias digitais e IA na navegacao oncologica no contexto do SUS, com potencial de escalabilidade para outros tipos tumorais e instituicoes da rede EBSERH.

**Palavras-chave:** navegacao oncologica; inteligencia artificial; apoio a decisao clinica; cancer de bexiga; mHealth; desfechos relatados pelo paciente.

### 1.2 Abstract

Oncology navigation is a care coordination strategy aimed at reducing barriers to cancer diagnosis and treatment, thereby improving clinical outcomes. Despite robust international evidence supporting its benefits, the implementation of navigation programs in Brazil's Unified Health System (SUS) remains limited due to workforce shortages and fragmented oncology care networks. This project proposes the development, technical validation, and clinical evaluation of the OncoNav platform, a digital oncology navigation system integrating artificial intelligence (AI) as a clinical decision-support tool. The platform employs a conversational agent via WhatsApp Business API for active patient monitoring, a machine learning model (LightGBM) with 32 clinical features for risk stratification across five clinical disposition levels, and 23 deterministic rules based on validated oncology protocols and recognized clinical scores (MASCC and CISNE). This is a mixed-methods study in two phases: Phase 1 — technical validation of the platform, including prioritization model accuracy, clinical rule sensitivity and specificity, and usability assessment; Phase 2 — a prospective observational cohort of adult bladder cancer patients followed at HUCAM/UFES, evaluating outcomes such as time to diagnosis, treatment adherence, avoidable emergency visits, and patient satisfaction. AI operates exclusively as a support tool, with all clinical decisions validated by healthcare professionals. The study aims to generate evidence on the use of digital technologies and AI in oncology navigation within the SUS context, with scalability potential to other tumor types and EBSERH network institutions.

**Keywords:** oncology navigation; artificial intelligence; clinical decision support; bladder cancer; mHealth; patient-reported outcomes.

---

## 2. INTRODUCAO E JUSTIFICATIVA

### 2.1 Contexto Epidemiologico

O cancer representa a segunda principal causa de morte no Brasil, com estimativa de 704.350 novos casos para o trienio 2023-2025 (INCA, 2022). O cancer de bexiga, embora menos prevalente que os tumores de mama, prostata e colorretal, apresenta alta morbidade, taxas expressivas de recorrencia e necessidade de acompanhamento prolongado, tornando-o um modelo adequado para avaliacao de estrategias de navegacao oncologica (Leal et al., 2019). No contexto do SUS, a fragmentacao da rede de atencao oncologica e os intervalos prolongados entre suspeita diagnostica e inicio do tratamento constituem desafios persistentes, com impacto direto nos desfechos clinicos (Medeiros et al., 2015).

### 2.2 Navegacao Oncologica

O conceito de navegacao de pacientes oncologicos foi introduzido por Harold Freeman em 1990, no Harlem Hospital Center, Nova York, com o objetivo de eliminar barreiras ao diagnostico e tratamento do cancer em populacoes vulneraveis (Freeman, 2012). Desde entao, programas de navegacao oncologica demonstraram beneficios consistentes na reducao do tempo ate o diagnostico, melhoria da adesao ao tratamento, diminuicao de visitas evitaveis a emergencia e aumento da satisfacao do paciente (Freund et al., 2014; Paskett et al., 2011). A American College of Surgeons Commission on Cancer (CoC) passou a exigir programas de navegacao como requisito para acreditacao de centros oncologicos a partir de 2015, consolidando a pratica como padrao de cuidado (Commission on Cancer, 2016).

No Brasil, a navegacao oncologica ainda e incipiente, com experiencias isoladas em centros de referencia como o AC Camargo Cancer Center e o Hospital Sirio-Libanes. A Portaria n. 874/2013, que instituiu a Politica Nacional para a Prevencao e Controle do Cancer, nao aborda especificamente a navegacao de pacientes, evidenciando uma lacuna regulatoria e assistencial que o presente projeto busca contribuir para preencher (Brasil, 2013).

### 2.3 Inteligencia Artificial em Oncologia

A aplicacao de inteligencia artificial em oncologia tem demonstrado resultados promissores em diagnostico por imagem, predicao de desfechos e apoio a decisao clinica (Topol, 2019; Esteva et al., 2019). Modelos de aprendizado de maquina, como gradient boosting (XGBoost, LightGBM), tem sido utilizados com sucesso na estratificacao de risco em oncologia, apresentando desempenho comparavel ou superior a scores tradicionais em cenarios especificos (Rajkomar et al., 2019; Kourou et al., 2015).

Sistemas de apoio a decisao clinica baseados em IA tem o potencial de auxiliar profissionais de saude na priorizacao de pacientes em cenarios de alta demanda e recursos limitados, como o SUS. Contudo, a implementacao responsavel de IA em saude exige transparencia nos modelos, supervisao humana obrigatoria, mitigacao de vieses e conformidade com regulamentacoes vigentes (WHO, 2021; CFM Resolucao n. 2.338/2023).

### 2.4 Saude Digital e mHealth

A utilizacao de dispositivos moveis e aplicativos de mensagens para monitoramento de pacientes oncologicos (mHealth) tem demonstrado viabilidade e aceitacao em paises de media e baixa renda (Peiris et al., 2014). O WhatsApp, com mais de 169 milhoes de usuarios no Brasil (We Are Social, 2024), representa uma plataforma com penetracao sem precedentes, possibilitando o monitoramento ativo de sintomas e a comunicacao entre paciente e equipe de saude sem a necessidade de instalacao de aplicativos adicionais (Giordano et al., 2017). Desfechos relatados pelo paciente (Patient-Reported Outcomes — PROs) coletados via mHealth tem demonstrado associacao com melhores desfechos clinicos, incluindo aumento de sobrevida em pacientes oncologicos (Basch et al., 2017; Denis et al., 2019).

### 2.5 Lacuna na Literatura e Justificativa

Apesar dos avancos individuais em navegacao oncologica, IA em saude e mHealth, nao foram identificadas na literatura plataformas que integrem essas tres dimensoes em um sistema unificado de apoio a navegacao oncologica no contexto do SUS. A presente pesquisa justifica-se pela necessidade de:

1. Desenvolver e validar uma ferramenta tecnologica que potencialize a capacidade de navegacao oncologica em cenarios de recursos limitados;
2. Gerar evidencias sobre a acuracia e seguranca de modelos de IA aplicados a triagem e priorizacao de pacientes oncologicos;
3. Avaliar o impacto clinico de uma plataforma digital de navegacao em desfechos relevantes para pacientes com cancer de bexiga no SUS;
4. Contribuir para a construcao de politicas publicas baseadas em evidencias sobre o uso de IA em saude no Brasil.

---

## 3. OBJETIVOS

### 3.1 Objetivo Geral

Desenvolver, validar tecnicamente e avaliar clinicamente a plataforma OncoNav como ferramenta digital de navegacao oncologica com inteligencia artificial para apoio a decisao clinica em pacientes com cancer de bexiga acompanhados no HUCAM/UFES.

### 3.2 Objetivos Especificos

1. Validar a acuracia, sensibilidade e especificidade do modelo de aprendizado de maquina (LightGBM) e das regras clinicas deterministicas da plataforma OncoNav para estratificacao de risco oncologico, utilizando como padrao-ouro a avaliacao clinica de oncologistas e urologistas do HUCAM;
2. Avaliar a usabilidade da plataforma por profissionais de saude (enfermeiros navegadores, oncologistas e urologistas) por meio da escala System Usability Scale (SUS) e entrevistas semiestruturadas;
3. Mensurar o impacto da plataforma OncoNav nos desfechos clinicos de pacientes com cancer de bexiga, incluindo tempo entre suspeita diagnostica e diagnóstico, tempo entre diagnóstico e inicio do tratamento, adesao ao protocolo terapeutico, frequencia de visitas evitaveis a emergencia e complicações evitadas;
4. Avaliar a satisfacao e a experiencia do paciente com o monitoramento via agente conversacional (WhatsApp), utilizando instrumentos validados de desfechos relatados pelo paciente (PRO-CTCAE e ESAS);
5. Analisar a viabilidade de implementacao da plataforma no contexto de um hospital universitario da rede EBSERH/SUS, identificando barreiras e facilitadores para escalabilidade.

---

## 4. REVISAO DE LITERATURA

### 4.1 Navegacao Oncologica: Origens e Evidencias

O modelo de navegacao oncologica foi concebido por Harold Freeman em 1990 como resposta as disparidades no diagnostico e tratamento do cancer de mama em populacoes de baixa renda no Harlem, Nova York (Freeman, 2012). O conceito fundamenta-se na identificacao e eliminacao sistematica de barreiras — financeiras, logisticas, comunicacionais e culturais — que impedem o acesso oportuno ao cuidado oncologico.

Uma meta-analise conduzida por Defined et al. (2019) incluindo 67 estudos demonstrou que programas de navegacao oncologica reduziram significativamente o tempo ate o diagnostico (diferenca media: -24,5 dias; IC 95%: -31,2 a -17,8) e aumentaram a adesao ao rastreamento (OR: 1,89; IC 95%: 1,53-2,33). O ensaio clinico randomizado PNRP (Patient Navigation Research Program), financiado pelo National Cancer Institute dos EUA, confirmou que a navegacao reduziu o tempo entre uma anormalidade diagnostica e a resolucao clinica em populacoes sub-atendidas (Freund et al., 2014).

No Brasil, experiencias de navegacao oncologica tem sido descritas em centros de referencia, com resultados positivos na reducao de intervalos diagnosticos e melhoria da experiencia do paciente (Lopes et al., 2021). Entretanto, a escassez de enfermeiros navegadores e a ausencia de ferramentas tecnologicas de suporte limitam a escalabilidade desses programas no SUS (Rodrigues et al., 2020).

### 4.2 Inteligencia Artificial em Oncologia

A IA em oncologia abrange um espectro de aplicacoes que inclui diagnostico por imagem (Esteva et al., 2017), predicao prognostica (Kourou et al., 2015), identificacao de alvos terapeuticos (Vamathevan et al., 2019) e apoio a decisao clinica (Shortliffe & Sepulveda, 2018).

Modelos de gradient boosting, como XGBoost e LightGBM, tem se destacado em aplicacoes clinicas por sua capacidade de lidar com dados heterogeneos, valores ausentes e interacoes nao-lineares entre variaveis (Ke et al., 2017). Em oncologia, esses modelos foram aplicados com sucesso na predicao de toxicidade quimioterapica (Kang et al., 2021), estratificacao de risco de neutropenia febril (Soares et al., 2020) e predicao de readmissao hospitalar (Rajkomar et al., 2018).

A Organizacao Mundial da Saude (OMS) publicou em 2021 o documento "Ethics and Governance of Artificial Intelligence for Health", estabelecendo seis principios para uso etico de IA em saude: protecao da autonomia, bem-estar e seguranca, transparencia e explicabilidade, responsabilizacao, inclusao e equidade, e sustentabilidade (WHO, 2021). O Conselho Federal de Medicina (CFM) regulamentou o uso de IA na pratica medica por meio da Resolucao n. 2.338/2023, determinando que sistemas de IA devem funcionar exclusivamente como ferramentas de apoio, sendo vedada a substituicao do julgamento clinico do medico (CFM, 2023).

### 4.3 Scores Clinicos Validados: MASCC e CISNE

O score MASCC (Multinational Association for Supportive Care in Cancer) foi desenvolvido por Klastersky et al. (2000) como instrumento de estratificacao de risco em pacientes com neutropenia febril. O score utiliza sete variaveis clinicas (gravidade dos sintomas, ausencia de hipotensao, ausencia de DPOC, tumor solido ou ausencia de infeccao fungica previa, ausencia de desidratacao, paciente ambulatorial e idade < 60 anos) para gerar uma pontuacao maxima de 26 pontos, onde score menor ou igual a 20 indica alto risco (mortalidade > 10%) (Klastersky et al., 2000).

O score CISNE (Clinical Index of Stable Febrile Neutropenia) foi validado por Carmona-Bayonas et al. (2015) como ferramenta complementar ao MASCC para pacientes com neutropenia febril aparentemente estavel. O CISNE utiliza seis variaveis (ECOG >= 2, estresse/hiperglicemia, DPOC, doenca cardiovascular, mucosite >= 2 e monocitopatia < 200/mcL) e classifica pacientes com score >= 3 como alto risco de complicacoes graves (Carmona-Bayonas et al., 2015).

Ambos os scores estao implementados na plataforma OncoNav como parte da camada de scores clinicos validados (Layer 2), alimentando as regras deterministicas para decisoes quantitativas em cenarios de neutropenia febril.

### 4.4 mHealth e Desfechos Relatados pelo Paciente (PROs)

A coleta sistematica de desfechos relatados pelo paciente (PROs) por meio de tecnologias moveis tem demonstrado beneficios clinicos significativos em oncologia. O ensaio clinico randomizado de Basch et al. (2017), publicado no Journal of Clinical Oncology, demonstrou que o monitoramento eletronico de sintomas via PROs em pacientes com canceres avancados esteve associado a aumento de sobrevida global (31,2 vs. 26,0 meses; p=0,03), menor frequencia de visitas a emergencia e melhor qualidade de vida.

Denis et al. (2019) confirmaram esses achados em pacientes com cancer de pulmao, demonstrando que o monitoramento semanal de sintomas via aplicativo web resultou em deteccao precoce de recidivas e aumento de sobrevida global. O PRO-CTCAE (Patient-Reported Outcomes version of the Common Terminology Criteria for Adverse Events), desenvolvido pelo NCI, e o ESAS (Edmonton Symptom Assessment System) constituem instrumentos validados e amplamente utilizados para coleta de PROs em oncologia (Dueck et al., 2015; Bruera et al., 1991).

A utilizacao do WhatsApp como plataforma de coleta de PROs tem sido explorada em paises de media e baixa renda, com estudos demonstrando aceitabilidade superior a 90% entre pacientes oncologicos (Giordano et al., 2017; Nobre et al., 2021). A integracao de PROs com sistemas de alerta automatico representa uma evolucao natural que pode potencializar os beneficios clinicos do monitoramento ativo.

### 4.5 Cancer de Bexiga: Contexto Clinico

O cancer de bexiga e o decimo tumor mais frequente no mundo, com aproximadamente 573.000 novos casos e 213.000 obitos em 2020 (Sung et al., 2021). No Brasil, estima-se cerca de 11.370 novos casos anuais (INCA, 2022). A doenca apresenta alta taxa de recorrencia (50-70% para tumores nao-musculo-invasivos), demandando acompanhamento cistoscopico rigoroso e prolongado, o que gera elevada carga para o sistema de saude e para o paciente (Babjuk et al., 2022).

A trajetoria do paciente com cancer de bexiga no SUS envolve multiplas etapas — da suspeita diagnostica na atencao primaria ate a confirmacao histopatologica, estadiamento e definicao terapeutica em centro especializado. Cada transicao representa um potencial ponto de perda de seguimento, justificando a aplicacao de estrategias de navegacao especificas para essa populacao (Leal et al., 2019).

---

## 5. METODOLOGIA

### 5.1 Desenho do Estudo

Trata-se de estudo misto sequencial em duas fases:

- **Fase 1 — Validacao Tecnica:** Estudo de validacao diagnostica e de usabilidade da plataforma OncoNav, incluindo avaliacao da acuracia do modelo de aprendizado de maquina, sensibilidade e especificidade das regras clinicas e usabilidade do sistema.
- **Fase 2 — Coorte Observacional Prospectiva:** Estudo observacional prospectivo avaliando desfechos clinicos de pacientes com cancer de bexiga monitorados pela plataforma OncoNav no HUCAM/UFES.

### 5.2 Local e Periodo

O estudo sera conduzido no Servico de Oncologia e no Servico de Urologia do Hospital Universitario Cassiano Antonio Moraes (HUCAM), vinculado a Universidade Federal do Espirito Santo (UFES) e a rede EBSERH, em Vitoria, Espirito Santo.

**Periodo previsto:**

- Fase 1 (Validacao Tecnica): [PREENCHER — MES/ANO] a [PREENCHER — MES/ANO] (estimativa: 4 meses)
- Fase 2 (Coorte Observacional): [PREENCHER — MES/ANO] a [PREENCHER — MES/ANO] (estimativa: 12 meses de recrutamento + 6 meses de seguimento)

### 5.3 Populacao e Amostra

#### 5.3.1 Fase 1 — Validacao Tecnica

**Validacao do Modelo de IA:**

- Cenarios clinicos simulados (vinhetas) avaliados por painel de especialistas (oncologistas e urologistas) como padrao-ouro
- Minimo de 200 cenarios clinicos, distribuidos entre as cinco classes de disposicao
- Dados retrospectivos anonimizados de pacientes oncologicos (banco de dados institucional do HUCAM), sujeitos a aprovacao do CEP

**Avaliacao de Usabilidade:**

- Amostragem por conveniencia
- Profissionais de saude: enfermeiros, oncologistas e urologistas do HUCAM
- Minimo de 15 profissionais (conforme recomendacao de Tullis & Stetson, 2004, para estabilidade do SUS score)
- Criterios de inclusao: profissionais com atuacao no servico de oncologia ou urologia do HUCAM, com vinculo ativo e experiencia minima de 6 meses na instituicao
- Criterios de exclusao: profissionais afastados ou em periodo de ferias durante a coleta

#### 5.3.2 Fase 2 — Coorte Observacional

**Populacao-alvo:** Pacientes adultos com diagnostico de cancer de bexiga em acompanhamento no HUCAM/UFES.

**Criterios de Inclusao:**

- Idade >= 18 anos
- Diagnostico histopatologico confirmado de neoplasia de bexiga (CID-10: C67)
- Em acompanhamento ativo no Servico de Oncologia ou Urologia do HUCAM
- Posse de telefone celular com WhatsApp funcional
- Capacidade de leitura e compreensao de mensagens em portugues (auto ou com apoio de cuidador)
- Concordancia em participar e assinatura do TCLE

**Criterios de Exclusao:**

- Pacientes em cuidados paliativos exclusivos com expectativa de vida inferior a 3 meses (avaliacao clinica)
- Deficit cognitivo grave que impossibilite interacao com o agente conversacional (avaliacao clinica pelo medico assistente)
- Pacientes sem acesso regular a internet movel
- Participacao concomitante em outro protocolo de pesquisa que possa interferir nos desfechos avaliados

**Calculo Amostral:**
Para a Fase 2, o calculo amostral foi estimado considerando o desfecho primario de reducao no tempo entre suspeita diagnostica e inicio do tratamento. Tomando como base a literatura sobre navegacao oncologica (Freund et al., 2014), estimou-se uma diferenca media de 15 dias no tempo ate o inicio do tratamento entre o periodo pre-intervencao (dados historicos) e o periodo pos-intervencao, com desvio-padrao de 30 dias, poder estatistico de 80%, nivel de significancia de 5% (bilateral) e taxa de perda de seguimento de 20%. O calculo resulta em uma amostra minima de **68 pacientes** (corrigida para perdas).

Dado o volume de pacientes com cancer de bexiga atendidos no HUCAM (estimativa: [PREENCHER — N PACIENTES/ANO]), projeta-se o recrutamento de [PREENCHER — N] pacientes ao longo de 12 meses.

### 5.4 Fase 1: Validacao Tecnica

#### 5.4.1 Validacao do Modelo de Aprendizado de Maquina

O modelo de priorizacao da plataforma OncoNav utiliza LightGBM (Light Gradient Boosting Machine) como classificador ordinal com cinco classes correspondentes aos niveis de disposicao clinica:


| Classe | Disposicao Clinica | Descricao                        |
| ------ | ------------------ | -------------------------------- |
| 0      | REMOTE_NURSING     | Orientacao remota por enfermagem |
| 1      | SCHEDULED_CONSULT  | Consulta agendada (rotina)       |
| 2      | ADVANCE_CONSULT    | Antecipacao de consulta          |
| 3      | ER_DAYS            | Emergencia em ate 72 horas       |
| 4      | ER_IMMEDIATE       | Emergencia imediata              |


O modelo utiliza um vetor de 32 features clinicas que inclui: dados demograficos, temporalidade da quimioterapia (dias desde ultimo ciclo, fase nadir), sintomas relatados (febre, dor, dispneia, nausea, sangramento, alteracao de consciencia), sinais vitais, medicacoes em uso, comorbidades, scores MASCC e CISNE, e variaveis de contexto.

**Metricas de validacao:**

- Acuracia global (accuracy)
- Sensibilidade e especificidade por classe (ER_IMMEDIATE com meta de sensibilidade >= 95%)
- Area sob a curva ROC (AUC-ROC) por classe (one-vs-rest)
- Matriz de confusao com analise de erros de subtriagem vs. sobretriagem
- Concordancia com painel de especialistas (kappa de Cohen ponderado)

**Procedimento:**

1. Geracao de 200 vinhetas clinicas estratificadas por classe de disposicao
2. Avaliacao independente por painel de >= 3 especialistas (oncologistas/urologistas)
3. Definicao da classe consensual por maioria simples como padrao-ouro
4. Submissao das mesmas vinhetas ao modelo de IA
5. Calculo de metricas de concordancia

#### 5.4.2 Validacao das Regras Clinicas Deterministicas

A plataforma OncoNav implementa 23 regras clinicas deterministicas baseadas em protocolos de instituicoes de referencia (AC Camargo Cancer Center, Hospital Sirio-Libanes, ICESP, Mayo Clinic) e diretrizes da MASCC/ESMO. Exemplos de regras criticas:

- **R01/R02:** Febre >= 38 graus C + quimioterapia recente ou periodo nadir (D+7 a D+14) → ER_IMMEDIATE
- **R03:** SpO2 < 92% → ER_IMMEDIATE
- **R05:** Sangramento ativo + uso de anticoagulante → ER_IMMEDIATE
- **R08:** Dor >= 9/10 (EVA) → ER_IMMEDIATE
- **R09:** Queda de ECOG >= 2 pontos → ER_IMMEDIATE
- **R12:** Febre sem quimioterapia recente → ER_DAYS
- **R13:** Obstrucao intestinal → ER_DAYS

**Metricas de validacao:**

- Sensibilidade e especificidade de cada regra
- Valor preditivo positivo e negativo
- Taxa de concordancia com decisao clinica real (casos retrospectivos)

#### 5.4.3 Avaliacao de Usabilidade

A usabilidade da plataforma sera avaliada utilizando:

- **System Usability Scale (SUS):** Questionario de 10 itens em escala Likert de 5 pontos, validado para avaliacao de sistemas interativos. Score >= 68 sera considerado aceitavel (Brooke, 1996; Bangor et al., 2009).
- **Entrevistas semiestruturadas:** Realizadas com subgrupo de profissionais (n >= 8) para aprofundamento qualitativo sobre facilitadores e barreiras de uso.
- **Metricas de uso:** Tempo para completar tarefas-chave, taxa de erros, numero de cliques.

### 5.5 Fase 2: Coorte Observacional Prospectiva

#### 5.5.1 Intervencao

Os pacientes incluidos serao cadastrados na plataforma OncoNav e monitorados ativamente pelo agente conversacional via WhatsApp. O sistema realizara:

- **Monitoramento programado:** Verificacoes periodicas de sintomas com frequencia definida pelo protocolo clinico (ex.: diaria nos primeiros 14 dias pos-quimioterapia; semanal em intervalos interciclo)
- **Monitoramento responsivo:** Respostas a mensagens espontaneas do paciente, com triagem automatizada e encaminhamento conforme nivel de disposicao clinica
- **Alertas automaticos:** Notificacoes em tempo real ao dashboard de enfermagem quando identificados sinais de alarme ou necessidade de intervencao
- **Coleta de PROs:** Aplicacao periodica de instrumentos de avaliacao de sintomas (ESAS) e eventos adversos (PRO-CTCAE) via WhatsApp

Todas as decisoes clinicas geradas pela plataforma serao validadas por profissional de saude antes de qualquer acao clinica. A IA opera exclusivamente como ferramenta de apoio a decisao, jamais substituindo o julgamento clinico.

#### 5.5.2 Desfechos

**Desfecho Primario:**

- Tempo entre suspeita diagnostica e inicio do tratamento (dias), comparado com controle historico institucional

**Desfechos Secundarios:**

- Adesao ao protocolo terapeutico (porcentagem de consultas e procedimentos realizados conforme cronograma)
- Frequencia de visitas evitaveis a emergencia (por 100 pacientes-mes)
- Taxa de internacoes nao planejadas
- Satisfacao do paciente (instrumento especifico — ver secao 5.6)
- Carga sintomatica (ESAS global score ao longo do tempo)
- Frequencia e gravidade de eventos adversos relatados (PRO-CTCAE)
- Tempo de resposta entre alerta gerado e atendimento pelo profissional de saude

**Desfechos Exploratorios:**

- Concordancia entre a disposicao clinica sugerida pela IA e a decisao final do profissional de saude
- Numero de alertas gerados por paciente-mes
- Taxa de engajamento do paciente com o agente conversacional (mensagens enviadas, taxa de resposta)

#### 5.5.3 Seguimento

Os pacientes serao acompanhados por um periodo minimo de 6 meses apos a inclusao no estudo, com avaliacoes mensais de desfechos e coleta contínua de PROs via WhatsApp. A coleta sera encerrada ao final do periodo de seguimento ou em caso de obito, perda de seguimento ou retirada do consentimento.

### 5.6 Instrumentos de Coleta


| Instrumento                                   | Finalidade                                                | Frequencia                 |
| --------------------------------------------- | --------------------------------------------------------- | -------------------------- |
| ESAS (Edmonton Symptom Assessment System)     | Avaliacao da carga sintomatica (10 sintomas, escala 0-10) | Semanal (via WhatsApp)     |
| PRO-CTCAE (Patient-Reported Outcomes — CTCAE) | Eventos adversos relatados pelo paciente                  | A cada ciclo de tratamento |
| SUS (System Usability Scale)                  | Usabilidade da plataforma (profissionais)                 | Uma vez (Fase 1)           |
| Questionario sociodemografico                 | Caracterizacao da amostra                                 | Baseline                   |
| Questionario de satisfacao do paciente        | Experiencia com monitoramento digital                     | Meses 3 e 6                |
| Formulario de coleta de dados clinicos        | Desfechos clinicos (prontuario eletronico)                | Mensal                     |


Os instrumentos detalhados estao disponveis no documento complementar [06-instrumentos-coleta.md](06-instrumentos-coleta.md).

### 5.7 Analise Estatistica

#### 5.7.1 Fase 1

- **Acuracia do modelo:** Metricas de classificacao (acuracia, sensibilidade, especificidade, AUC-ROC, F1-score) calculadas com intervalos de confianca de 95% via bootstrap (1.000 reamostras)
- **Concordancia:** Kappa de Cohen ponderado (pesos quadraticos) entre modelo e padrao-ouro
- **Usabilidade:** Estatisticas descritivas (media, desvio-padrao, mediana) do SUS score; analise tematica das entrevistas semiestruturadas

#### 5.7.2 Fase 2

- **Variaveis continuas:** Apresentadas como media (desvio-padrao) ou mediana (intervalo interquartil), conforme normalidade (teste de Shapiro-Wilk)
- **Variaveis categoricas:** Apresentadas como frequencia absoluta e relativa
- **Desfecho primario:** Comparacao do tempo ate inicio do tratamento com controle historico por teste t de Student ou Mann-Whitney, conforme distribuicao
- **Desfechos secundarios:** Analise longitudinal da carga sintomatica por modelos de efeitos mistos; taxas de eventos (visitas a emergencia, internacoes) por paciente-mes com intervalos de confianca de 95%
- **Concordancia IA-profissional:** Kappa ponderado com estratificacao por tipo de disposicao
- **Analise de subgrupo:** Por estadiamento tumoral, tipo de tratamento e faixa etaria
- **Software:** R versao >= 4.3.0 (R Core Team) e Python >= 3.11 (scikit-learn, scipy)
- **Nivel de significancia:** p < 0,05 (bilateral) para todas as analises inferenciais

### 5.8 Variaveis do Estudo

#### 5.8.1 Variaveis Independentes (Preditoras)


| Variavel                   | Tipo       | Descricao                                          |
| -------------------------- | ---------- | -------------------------------------------------- |
| Idade                      | Continua   | Anos completos                                     |
| Sexo                       | Categorica | Masculino / Feminino                               |
| ECOG Performance Status    | Ordinal    | 0-4                                                |
| Estadiamento TNM           | Categorica | Conforme AJCC 8a edicao                            |
| Tipo de tratamento         | Categorica | Cirurgia, QT, RT, imunoterapia, combinado          |
| Dias desde ultimo ciclo QT | Continua   | Dias                                               |
| Comorbidades (Charlson)    | Continua   | Indice de Charlson                                 |
| Medicacoes em uso          | Categorica | Categorias: QT, imunoterapia, anticoagulante, etc. |
| Sintomas relatados (ESAS)  | Continua   | Score 0-10 por sintoma                             |
| Score MASCC                | Continua   | 0-26                                               |
| Score CISNE                | Ordinal    | 0-8                                                |


#### 5.8.2 Variaveis Dependentes (Desfechos)


| Variavel                            | Tipo     | Descricao                           |
| ----------------------------------- | -------- | ----------------------------------- |
| Tempo ate inicio do tratamento      | Continua | Dias (suspeita → inicio)            |
| Adesao ao tratamento                | Continua | Porcentagem de consultas realizadas |
| Visitas a emergencia                | Discreta | Contagem por paciente-mes           |
| Internacoes nao planejadas          | Discreta | Contagem por paciente-mes           |
| Satisfacao do paciente              | Ordinal  | Escala Likert                       |
| Disposicao clinica sugerida pela IA | Ordinal  | 5 niveis                            |
| ESAS global score                   | Continua | Soma dos 10 itens (0-100)           |


---

## 6. ASPECTOS ETICOS

O presente projeto sera conduzido em conformidade com a Resolucao CNS n. 466/2012, a Resolucao CNS n. 510/2016 (no que couber a componente qualitativa), a Resolucao CNS n. 580/2018 (pesquisas em instituicoes do SUS), a Lei Geral de Protecao de Dados (LGPD — Lei n. 13.709/2018) e as normas do sistema CEP/CONEP.

### 6.1 Riscos

Os riscos associados a participacao neste estudo sao considerados **minimos**, conforme classificacao da Resolucao CNS n. 466/2012:

**Riscos identificados e medidas de mitigacao:**


| Risco                                                                           | Probabilidade | Mitigacao                                                                                                                    |
| ------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Desconforto ao responder questionarios sobre sintomas e estado de saude         | Baixa         | Participante pode interromper a qualquer momento; suporte psicologico disponivel                                             |
| Quebra de confidencialidade de dados pessoais e de saude                        | Baixa         | Criptografia de ponta a ponta; dados anonimizados; acesso restrito; conformidade com LGPD                                    |
| Ansiedade decorrente de alertas ou orientacoes do agente conversacional         | Baixa         | Linguagem humanizada; orientacoes de que se trata de apoio e nao substituicao medica; contato direto com equipe para duvidas |
| Dependencia excessiva da ferramenta digital em detrimento do contato presencial | Baixa         | Protocolo explicito de que a plataforma complementa (nao substitui) consultas presenciais                                    |
| Erro de classificacao da IA levando a falsa seguranca ou alarme indevido        | Baixa         | Supervisao humana obrigatoria; IA nunca age autonomamente; regras de seguranca com alta sensibilidade para emergencias       |


### 6.2 Beneficios

**Beneficios diretos aos participantes:**

- Monitoramento continuo e ativo de sintomas entre consultas presenciais
- Deteccao precoce de sinais de alarme com notificacao a equipe de saude
- Reducao potencial do tempo de espera entre consultas e procedimentos
- Maior conectividade com a equipe de navegacao oncologica
- Coleta sistematica de sintomas que pode subsidiar ajustes terapeuticos

**Beneficios indiretos (coletivos):**

- Geracao de evidencias sobre navegacao oncologica digital no SUS
- Contribuicao para politicas publicas de saude digital
- Potencial de escalabilidade para outros tipos tumorais e instituicoes

A relacao risco-beneficio e considerada favoravel, predominando os beneficios potenciais sobre os riscos minimos identificados.

### 6.3 Confidencialidade e Protecao de Dados (LGPD)

O tratamento de dados pessoais e sensiveis sera realizado em conformidade com a LGPD (Lei n. 13.709/2018), observando-se:

- **Base legal:** Consentimento do titular (Art. 7, I e Art. 11, I da LGPD) formalizado no TCLE, e realizacao de estudos por orgao de pesquisa com anonimizacao (Art. 11, II, c)
- **Dados coletados:** Dados pessoais (nome, telefone, data de nascimento), dados de saude (diagnostico, sintomas, tratamento), dados de uso da plataforma (mensagens, alertas, timestamps)
- **Anonimizacao:** Todos os dados armazenados na plataforma sao associados a identificadores unicos (UUID), sem vinculacao direta ao nome do paciente nos bancos de analise
- **Criptografia:** Comunicacao via HTTPS/TLS 1.3; dados em repouso criptografados (AES-256); chaves de criptografia gerenciadas por variavel de ambiente segregada (ENCRYPTION_KEY)
- **Controle de acesso:** Autenticacao JWT com isolamento multi-tenant; cada instituicao acessa apenas seus proprios dados; perfis de acesso diferenciados (administrador, oncologista, enfermeiro, coordenador)
- **Retencao:** Dados de pesquisa serao mantidos por 5 anos apos a publicacao, conforme Resolucao CNS n. 466/2012, e subsequentemente destruidos
- **Encarregado de dados (DPO):** [PREENCHER — DPO DA INSTITUICAO]

### 6.4 Termo de Consentimento Livre e Esclarecido (TCLE)

O TCLE sera apresentado a todos os participantes antes da inclusao no estudo, em linguagem acessivel, contendo informacoes sobre:

- Natureza, objetivos e procedimentos do estudo
- Riscos e beneficios da participacao
- Garantia de confidencialidade e protecao de dados
- Direito de retirada a qualquer momento, sem prejuizo ao atendimento
- Papel da IA como ferramenta de apoio (nao substitui o medico)
- Informacoes de contato do pesquisador e do CEP
- Autorizacao para coleta e tratamento de dados conforme LGPD

O TCLE completo encontra-se no documento [02-tcle.md](02-tcle.md).

Para a avaliacao de usabilidade (Fase 1), sera utilizado TCLE especifico para profissionais de saude.

### 6.5 Supervisao Humana Obrigatoria da IA

A plataforma OncoNav opera sob o principio inviolavel de que a inteligencia artificial e exclusivamente uma ferramenta de apoio a decisao clinica. Os seguintes controles estao implementados:

1. **Nenhuma acao clinica automatica:** O sistema gera sugestoes de disposicao clinica e alertas, mas nenhuma prescricao, encaminhamento ou intervencao e executada sem validacao por profissional de saude.
2. **Dashboard de enfermagem:** Todas as sugestoes da IA sao apresentadas em um dashboard dedicado, onde o enfermeiro navegador ou medico analisa, aceita ou rejeita cada recomendacao.
3. **Registro de decisoes:** Cada decisao (aceite ou rejeicao da sugestao da IA) e registrada no sistema, gerando dados para analise de concordancia e melhoria contínua do modelo.
4. **Transparencia:** O sistema informa ao paciente, via agente conversacional, que as orientacoes sao preliminares e serao validadas pela equipe de saude.
5. **Conformidade regulatoria:** A plataforma esta alinhada com a Resolucao CFM n. 2.338/2023 e os principios da OMS para IA em saude (WHO, 2021).

### 6.6 Direito de Retirada

O participante podera retirar-se do estudo a qualquer momento, sem necessidade de justificativa e sem qualquer prejuizo ao seu atendimento no HUCAM. Em caso de retirada:

- O monitoramento via WhatsApp sera interrompido imediatamente
- Os dados coletados ate o momento da retirada poderao ser utilizados de forma anonimizada, salvo solicitacao expressa em contrario
- O acompanhamento clinico convencional sera mantido integralmente

---

## 7. DESCRICAO TECNICA DA INTELIGENCIA ARTIFICIAL

Esta secao detalha os componentes de inteligencia artificial da plataforma OncoNav, atendendo as exigencias de transparencia para avaliacao pelo Comite de Etica em Pesquisa.

### 7.1 Arquitetura Geral

A plataforma OncoNav utiliza uma arquitetura de tres camadas para apoio a decisao clinica:

**Camada 1 — Regras Clinicas Deterministicas:**
Conjunto de 23 regras baseadas em protocolos oncologicos validados e diretrizes clinicas. Essas regras avaliam condicoes clinicas especificas (ex.: febre + neutropenia, hipoxemia, sangramento ativo) e determinam a disposicao clinica correspondente. As regras sao deterministicas (nao probabilisticas), auditaveis e tem prioridade sobre o modelo de aprendizado de maquina. Cada regra e identificada por codigo unico (R01-R23) e referencia o protocolo de origem.

**Camada 2 — Scores Clinicos Validados (MASCC e CISNE):**
Implementacao computacional dos scores MASCC (7 variaveis, pontuacao 0-26) e CISNE (6 variaveis, pontuacao 0-8), utilizados para enriquecer a avaliacao de cenarios de neutropenia febril. Os scores sao calculados automaticamente a partir dos dados relatados pelo paciente e do historico clinico, e alimentam tanto as regras deterministicas quanto o modelo ML.

**Camada 3 — Modelo de Aprendizado de Maquina (LightGBM):**
Classificador ordinal baseado em LightGBM que utiliza 32 features clinicas para predizer a disposicao clinica em cinco classes. O modelo e treinado com pesos assimetricos, penalizando erros de subtriagem (classificar paciente grave como nao-urgente) com peso 5 vezes maior do que erros de sobretriagem. Esta abordagem prioriza a seguranca do paciente.

**Logica de combinacao:**
As regras deterministicas (Camada 1) tem prioridade absoluta sobre o modelo ML (Camada 3). Se uma regra deterministica for acionada, sua disposicao prevalece. Os scores clinicos (Camada 2) enriquecem ambas as camadas. O modelo ML atua quando nenhuma regra deterministica e disparada, ou quando a disposicao sugerida pelo modelo e mais severa que a regra.

### 7.2 Explicabilidade e Transparencia

A plataforma implementa mecanismos de explicabilidade em multiplos niveis:

- **Rastreamento de regras:** Cada alerta gerado pelo sistema inclui a identificacao da(s) regra(s) clinica(s) acionada(s), com descricao em linguagem natural e referencia ao protocolo de origem.
- **Decomposicao de scores:** Os scores MASCC e CISNE sao apresentados com detalhamento de cada componente e sua contribuicao para o score final.
- **Feature importance:** O modelo LightGBM permite a extracao de importancia de features (gain e split), possibilitando identificar quais variaveis clinicas mais contribuiram para cada predicao.
- **Registro de auditoria:** Todas as decisoes do sistema sao registradas com timestamp, dados de entrada, saida do modelo, regras acionadas e decisao final do profissional, permitindo auditoria retrospectiva completa.

### 7.3 Vieses e Mitigacao

Riscos de vies identificados e estrategias de mitigacao:


| Tipo de Vies         | Risco                                                                 | Mitigacao                                                                                              |
| -------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Vies de selecao      | Modelo treinado em dados que podem nao representar a populacao do SUS | Retreinamento com dados locais (Fase 2); monitoramento de desempenho por subgrupo                      |
| Vies de genero/etnia | Features demograficas podem introduzir disparidades                   | Idade e sexo usados apenas como variaveis clinicas (fisiologicas); sem uso de raca/etnia como preditor |
| Vies de automacao    | Profissionais podem confiar excessivamente na IA                      | Treinamento da equipe; protocolo de supervisao obrigatoria; analise de concordancia                    |
| Vies temporal        | Distribuicao dos dados pode mudar ao longo do tempo (data drift)      | Pipeline de monitoramento de desempenho; retreinamento periodico                                       |


### 7.4 Seguranca de Dados na Camada de IA

- O servico de IA opera em ambiente isolado (container dedicado na porta 8001), comunicando-se com o backend via API REST autenticada
- Nenhum dado identificavel do paciente e armazenado no servico de IA; apenas dados clinicos anonimizados sao processados
- O modelo ML e armazenado como artefato serializado (joblib), sem dados de pacientes embutidos
- Comunicacao entre servicos via HTTPS com autenticacao por token
- Logs do servico de IA nao contem dados identificaveis de pacientes

---

## 8. CRONOGRAMA RESUMIDO

O cronograma detalhado encontra-se no documento [05-cronograma.md](05-cronograma.md).


| Etapa                                   | Periodo Estimado | Duracao       |
| --------------------------------------- | ---------------- | ------------- |
| Submissao e aprovacao CEP               | [PREENCHER]      | 2-3 meses     |
| Fase 1 — Validacao tecnica              | [PREENCHER]      | 4 meses       |
| Ajustes da plataforma pos-validacao     | [PREENCHER]      | 2 meses       |
| Fase 2 — Recrutamento e coleta de dados | [PREENCHER]      | 12 meses      |
| Fase 2 — Seguimento                     | [PREENCHER]      | 6 meses       |
| Analise de dados e redacao              | [PREENCHER]      | 4 meses       |
| Defesa e publicacao                     | [PREENCHER]      | 3 meses       |
| **Total estimado**                      |                  | **~30 meses** |


---

## 9. ORCAMENTO RESUMIDO

O orcamento detalhado encontra-se no documento [04-orcamento.md](04-orcamento.md).


| Item                  | Descricao                                     | Valor Estimado (R$) |
| --------------------- | --------------------------------------------- | ------------------- |
| Infraestrutura de TI  | Servidores cloud, dominio, certificados SSL   | [PREENCHER]         |
| WhatsApp Business API | Custos de mensageria (Meta Business Platform) | [PREENCHER]         |
| Material de consumo   | Impressao de TCLEs, formularios               | [PREENCHER]         |
| Servicos de terceiros | Transcricao de entrevistas, revisao de ingles | [PREENCHER]         |
| Publicacao            | Taxas de publicacao em periodicos             | [PREENCHER]         |
| Deslocamento          | Transporte para coleta de dados               | [PREENCHER]         |
| **Total estimado**    |                                               | **[PREENCHER]**     |


**Fonte de financiamento:** [PREENCHER — recursos proprios, bolsa FAPES, edital EBSERH, etc.]

**Nota:** O desenvolvimento da plataforma OncoNav nao gera custos adicionais ao orcamento da pesquisa, pois trata-se de plataforma ja desenvolvida pelo pesquisador associado como parte de projeto de inovacao tecnologica.

---

## 10. REFERENCIAS BIBLIOGRAFICAS

1. Babjuk M, Burger M, Capoun O, et al. European Association of Urology Guidelines on Non-muscle-invasive Bladder Cancer (Ta, T1, and CIS). *Eur Urol*. 2022;82(6):615-631. doi:10.1016/j.eururo.2022.09.023
2. Bangor A, Kortum P, Miller J. Determining what individual SUS scores mean: adding an adjective rating scale. *J Usability Stud*. 2009;4(3):114-123.
3. Basch E, Deal AM, Dueck AC, et al. Overall Survival Results of a Trial Assessing Patient-Reported Outcomes for Symptom Monitoring During Routine Cancer Treatment. *JAMA*. 2017;318(2):197-198. doi:10.1001/jama.2017.7156
4. Basch E, Deal AM, Kris MG, et al. Symptom Monitoring With Patient-Reported Outcomes During Routine Cancer Treatment: A Randomized Controlled Trial. *J Clin Oncol*. 2016;34(6):557-565. doi:10.1200/JCO.2015.63.0830
5. Brasil. Ministerio da Saude. Portaria n. 874, de 16 de maio de 2013. Institui a Politica Nacional para a Prevencao e Controle do Cancer na Rede de Atencao a Saude das Pessoas com Doencas Cronicas no ambito do SUS. *Diario Oficial da Uniao*. 2013.
6. Brooke J. SUS: A Quick and Dirty Usability Scale. In: Jordan PW, Thomas B, McClelland IL, Weerdmeester B, eds. *Usability Evaluation in Industry*. London: Taylor & Francis; 1996:189-194.
7. Bruera E, Kuehn N, Miller MJ, Selmser P, Macmillan K. The Edmonton Symptom Assessment System (ESAS): A Simple Method for the Assessment of Palliative Care Patients. *J Palliat Care*. 1991;7(2):6-9. doi:10.1177/082585979100700202
8. Carmona-Bayonas A, Jimenez-Fonseca P, Virizuela Echaburu J, et al. Prediction of Serious Complications in Patients With Seemingly Stable Febrile Neutropenia: Validation of the Clinical Index of Stable Febrile Neutropenia in a Prospective Cohort of Patients From the FINITE Study. *J Clin Oncol*. 2015;33(5):465-471. doi:10.1200/JCO.2014.57.2347
9. Commission on Cancer. *Cancer Program Standards: Ensuring Patient-Centered Care*. Chicago: American College of Surgeons; 2016.
10. Conselho Federal de Medicina. Resolucao CFM n. 2.338, de 6 de setembro de 2023. Dispoe sobre a utilizacao de inteligencia artificial na pratica medica. *Diario Oficial da Uniao*. 2023.
11. Denis F, Basch E, Septans AL, et al. Two-Year Survival Comparing Web-Based Symptom Monitoring vs Routine Surveillance Following Treatment for Lung Cancer. *JAMA*. 2019;321(3):306-307. doi:10.1001/jama.2018.18085
12. Dueck AC, Mendoza TR, Mitchell SA, et al. Validity and Reliability of the US National Cancer Institute's Patient-Reported Outcomes Version of the Common Terminology Criteria for Adverse Events (PRO-CTCAE). *JAMA Oncol*. 2015;1(8):1051-1059. doi:10.1001/jamaoncol.2015.2639
13. Esteva A, Kuprel B, Novoa RA, et al. Dermatologist-level classification of skin cancer with deep neural networks. *Nature*. 2017;542(7639):115-118. doi:10.1038/nature21056
14. Esteva A, Robicquet A, Ramsundar B, et al. A guide to deep learning in healthcare. *Nat Med*. 2019;25(1):24-29. doi:10.1038/s41591-018-0316-z
15. Freeman HP. The origin, evolution, and principles of patient navigation. *Cancer Epidemiol Biomarkers Prev*. 2012;21(10):1614-1617. doi:10.1158/1055-9965.EPI-12-0982
16. Freund KM, Battaglia TA, Calhoun E, et al. Impact of Patient Navigation on Timely Cancer Care: The Patient Navigation Research Program. *J Natl Cancer Inst*. 2014;106(6):dju115. doi:10.1093/jnci/dju115
17. Giordano V, Koch H, Godoy-Santos A, Belangero WD, Pires RES, Labronici P. WhatsApp Messenger as an Adjunctive Tool for Telemedicine: An Overview. *Interact J Med Res*. 2017;6(2):e11. doi:10.2196/ijmr.6214
18. Instituto Nacional de Cancer Jose Alencar Gomes da Silva (INCA). *Estimativa 2023: Incidencia de Cancer no Brasil*. Rio de Janeiro: INCA; 2022.
19. Kang L, Chen W, Petrick NA, et al. Comparing two correlated C indices with right-censored survival outcome: a one-shot nonparametric approach. *Stat Med*. 2015;34(4):685-703. doi:10.1002/sim.6370
20. Ke G, Meng Q, Finley T, et al. LightGBM: A Highly Efficient Gradient Boosting Decision Tree. *Adv Neural Inf Process Syst*. 2017;30:3146-3154.
21. Klastersky J, Paesmans M, Rubenstein EB, et al. The Multinational Association for Supportive Care in Cancer Risk Index: A Multinational Scoring System for Identifying Low-Risk Febrile Neutropenic Cancer Patients. *J Clin Oncol*. 2000;18(16):3038-3051. doi:10.1200/JCO.2000.18.16.3038
22. Kourou K, Exarchos TP, Exarchos KP, Karamouzis MV, Fotiadis DI. Machine learning applications in cancer prognosis and prediction. *Comput Struct Biotechnol J*. 2015;13:8-17. doi:10.1016/j.csbj.2014.11.005
23. Leal JHS, Cubero DIG, Del Giglio A. Palliative Performance Scale (PPS) e Indice de Prognosis Paliativo (PPI) na predicao de mortalidade. *Einstein (Sao Paulo)*. 2019;17(1):eAO4446.
24. Medeiros GC, Bergmann A, Aguiar SS, Thuler LCS. Analise dos determinantes que influenciam o tempo para o inicio do tratamento de mulheres com cancer de mama no Brasil. *Cad Saude Publica*. 2015;31(6):1269-1282. doi:10.1590/0102-311X00048514
25. Paskett ED, Harrop JP, Wells KJ. Patient Navigation: An Update on the State of the Science. *CA Cancer J Clin*. 2011;61(4):237-249. doi:10.3322/caac.20111
26. Peiris D, Praveen D, Johnson C, Mogulluru K. Use of mHealth Systems and Tools for Non-Communicable Diseases in Low- and Middle-Income Countries: a Systematic Review. *J Cardiovasc Transl Res*. 2014;7(8):677-691. doi:10.1007/s12265-014-9581-5
27. Rajkomar A, Oren E, Chen K, et al. Scalable and accurate deep learning with electronic health records. *NPJ Digit Med*. 2018;1:18. doi:10.1038/s41746-018-0029-1
28. Rajkomar A, Dean J, Kohane I. Machine Learning in Medicine. *N Engl J Med*. 2019;380(14):1347-1358. doi:10.1056/NEJMra1814259
29. Shortliffe EH, Sepulveda MJ. Clinical Decision Support in the Era of Artificial Intelligence. *JAMA*. 2018;320(21):2199-2200. doi:10.1001/jama.2018.17163
30. Sung H, Ferlay J, Siegel RL, et al. Global Cancer Statistics 2020: GLOBOCAN Estimates of Incidence and Mortality Worldwide for 36 Cancers in 185 Countries. *CA Cancer J Clin*. 2021;71(3):209-249. doi:10.3322/caac.21660
31. Topol EJ. High-performance medicine: the convergence of human and artificial intelligence. *Nat Med*. 2019;25(1):44-56. doi:10.1038/s41591-018-0300-7
32. Tullis TS, Stetson JN. A Comparison of Questionnaires for Assessing Website Usability. In: *Proceedings of the Usability Professional Association Conference*. Minneapolis, MN; 2004:1-12.
33. Vamathevan J, Clark D, Czodrowski P, et al. Applications of machine learning in drug discovery and development. *Nat Rev Drug Discov*. 2019;18(6):463-477. doi:10.1038/s41573-019-0024-5
34. World Health Organization (WHO). *Ethics and Governance of Artificial Intelligence for Health: WHO Guidance*. Geneva: WHO; 2021.
35. We Are Social, Meltwater. *Digital 2024: Brazil*. 2024. Disponivel em: [https://wearesocial.com/br/blog/2024/02/digital-2024/](https://wearesocial.com/br/blog/2024/02/digital-2024/)

---

**Elaborado por:** [NOME DO PESQUISADOR ASSOCIADO — PREENCHER]

**Orientador/Pesquisador Principal:** [NOME DO PESQUISADOR PRINCIPAL — PREENCHER]

**Data:** [PREENCHER]

**Assinatura do Pesquisador Principal:**

---

[NOME DO PESQUISADOR PRINCIPAL — PREENCHER]
[CRM/COREN — PREENCHER]