# Preenchimento Fase 2 – Centelha ES (Proposta Técnica)

Textos prontos para copiar e colar no formulário. Sempre conferir no formulário oficial o limite de caracteres de cada campo (ex.: Edital 18/2025 – Centelha 3 ES).

---

## Resumo do negócio

**Limite no formulário:** 500 caracteres  
**Pergunta:** Descreva a solução e negócio de maneira clara e objetiva. Imagine que esse seja o único campo disponível para que você apresente a sua proposta. Destaque os principais pontos, como pretende viabilizar o negócio e de que forma pretende desenvolver a solução proposta.

### Texto para colar (≤500 caracteres)

Plataforma de navegação oncológica com IA (priorização, agente conversacional) e WhatsApp para coordenar cuidado e reduzir tempo até diagnóstico e readmissões. Única com navegação oncológica, priorização por IA e WhatsApp integrados. Viável por assinatura B2B (hospitais, CACONs); piloto HUCAM/UFES (validação e evidências); depois vendas e lote pioneiro. Desenvolvimento: stack em uso (Next.js, NestJS, FastAPI); piloto em Oncologia Urológica gera evidências para expansão.

**Contagem:** 495 caracteres.

---

## 1. Descrição da solução — “Qual é a solução desenvolvida?”

**Limite no formulário:** 2000 caracteres  
**Instruções:** Descrever detalhadamente a solução, destacando: (a) aspectos inovadores; (b) características e funcionalidades; (c) diferenciais competitivos em relação ao que existe no mercado; (d) benefícios que irá proporcionar aos potenciais clientes.

### Texto para colar (≤2000 caracteres)

A solução é uma plataforma SaaS multi-tenant que integra Inteligência Artificial e WhatsApp Business API para transformar o cuidado oncológico.

**a) Aspectos inovadores:** Priorização automática de casos com IA (modelo XGBoost, score 0-100, com explicabilidade); agente conversacional com LLM (GPT-4/Claude) e RAG em guidelines oncológicos (NCCN, ASCO); integração nativa com WhatsApp cloud api, sem necessidade de aplicativo próprio para o paciente; interoperabilidade HL7/FHIR com prontuários e sistemas existentes; alertas de risco, perda de seguimento, etapas atrasadas automáticos para equipe de navegação .

**b) Características e funcionalidades:** Três pilares — (1) Navegação Inteligente: dashboard centralizado que rastreia cada paciente em tempo real, da triagem ao seguimento; (2) Classificação de risco com IA: identificação instantânea de casos críticos; (3) Agente de IA no WhatsApp: coleta de dados clínicos por conversa natural, detecção de sintomas críticos e alertas automáticos à equipe com proatividade na navegação do paciente com check-ins regulares, aviso de consulta, procedimentos e exames. Arquitetura multi-tenant, com criptografia e conformidade LGPD.

**c) Diferenciais competitivos:** No mercado brasileiro não existe oferta que una navegação oncológica, priorização por IA e canal WhatsApp em uma única solução. As alternativas são fragmentadas (navegação manual, EHRs genéricos, telemedicina não especializada). O uso do WhatsApp elimina barreiras de adoção (sem instalação de app, acessível a qualquer smartphone).

**d) Benefícios aos potenciais clientes:** Coordenação automática entre especialidades; redução estimada de 30% no tempo até diagnóstico, 20-30% em readmissões evitáveis e 40% em ligações telefônicas; detecção precoce de complicações; dados clínicos estruturados automaticamente no fluxo de trabalho, aumentando a produtividade da equipe e a qualidade do cuidado.

---

**Contagem:** ~1.850 caracteres (dentro do limite de 2000).

---

## 2. Estratégia para o desenvolvimento do produto/solução

**Limite no formulário:** 1500 caracteres  
**Estágio atual indicado no formulário:** Comercialização pioneira (solução no mercado com algumas vendas, buscando venda de lote pioneiro).  
**Pergunta:** Como você pretende desenvolver a solução para que atinja o estágio de desenvolvimento planejado?  
**Instruções:** Descrever a estratégia destacando: (a) recursos necessários; (b) estratégia de produção; (c) pesquisas necessárias e como serão realizadas; (d) processos de certificação.

### Texto para colar (≤1500 caracteres)

A estratégia apoia-se em piloto institucional com validação científica e recursos do Centelha.

a) Recursos necessários: Humanos — equipe técnica atual e parceria HUCAM/UFES (piloto no Serviço de Oncologia Urológica). Financeiros — subvenção Centelha e contrapartida para cloud, APIs e operação do piloto. Infraestrutura — SaaS em nuvem; integração com fluxos do HUCAM (acordos de confidencialidade).

b) Estratégia de produção: SaaS = entrega contínua via cloud. Ciclo de releases com testes e monitoramento. Qualidade por boas práticas e, na expansão, processo documentado para certificação (ex. ISO 13485). Core interna; parceiros apenas para integração (EHR, hospitais).

c) Pesquisas necessárias e como serão realizadas: Estudo piloto no HUCAM (Oncologia Urológica) para validar efetividade — tempo até diagnóstico/tratamento, se os diagnósticos passam a ser mais precoces, adesão, satisfação da equipe e indicadores de navegação. Coorte pré/pós com aprovação em Comitê de Ética; evidências para publicações e expansão (outros serviços HUCAM, outras instituições). Complementares: refinamento do modelo de priorização (XGBoost) e validação de usabilidade.

d) Processos de certificação: LGPD já na arquitetura. Piloto não precisa de registro de software em saúde. Avaliação de enquadramento RDC ANVISA (SaMD). Após o piloto, documentar processo de qualidade para certificação conforme exigências de compradores e ANVISA.

---

**Contagem:** ~1.400 caracteres (dentro do limite de 1500).

---

## 3. Impacto socioambiental

**Limite no formulário:** 1500 caracteres  
**Opção marcada no formulário:** “O objetivo principal da solução proposta não é resolver um desafio socioambiental, mas algumas ações previstas geram impactos socioambientais positivos.”  
**Pergunta:** Quais são as ações previstas que geram impactos socioambientais positivos? Descreva o contexto de atuação e benefícios gerados pelas ações propostas.

### Texto para colar (≤1500 caracteres)

Contexto de atuação: O Brasil registra cerca de 704 mil novos casos de câncer por ano, com tempo médio de diagnóstico de 60 a 90 dias e fragmentação do cuidado entre especialidades. A solução é uma plataforma de navegação oncológica com IA e WhatsApp; o foco central é a coordenação e a eficiência do cuidado, mas as ações previstas geram impacto social positivo em saúde.

Ações previstas e benefícios gerados: (1) Uso do WhatsApp para contato com o paciente — elimina necessidade de aplicativo e custo extra, permite acesso a qualquer pessoa com smartphone e democratiza o cuidado para população vulnerável e usuários do SUS. (2) Navegação e priorização com IA — redução estimada de 30% no tempo até o diagnóstico e de 20 a 30% em readmissões evitáveis; melhora de prognósticos e maior chance de tratamento em estágios mais precoces. (3) Menos deslocamentos desnecessários — redução de cerca de 40% em consultas presenciais que podem ser resolvidas por triagem/contato remoto, diminuindo custos de transporte e tempo perdido para pacientes e familiares, com efeito indireto na redução de emissões. (4) Redução de sobrecarga da equipe e de ligações manuais — priorização inteligente e dados estruturados aumentam a produtividade da enfermagem e a qualidade do serviço, permitindo que hospitais públicos e instituições com poucos recursos ampliem o acesso ao cuidado coordenado. (5) Validação em serviço de oncologia com geração de evidências, ampliando o impacto social em saúde.

---

**Contagem:** ~1.480 caracteres (dentro do limite de 1500).

---

## 4. Impactos socioambientais negativos e estratégias de mitigação

**Limite no formulário:** 1500 caracteres  
**Pergunta:** Quais os potenciais impactos socioambientais negativos a partir de sua operação? Quais as estratégias para evitar/mitigar tais impactos?  
**Instrução:** Descreva os potenciais riscos socioambientais de sua operação e as estratégias de como evitar/mitigar impactos negativos.

### Texto para colar (≤1500 caracteres)

Potenciais impactos negativos e estratégias de mitigação:

(1) Dados de saúde e privacidade — Risco: vazamento ou uso indevido de dados sensíveis. Estratégias: arquitetura com criptografia em repouso e em trânsito (AES-256, TLS), conformidade LGPD desde o desenho do sistema, controle de acesso por perfil e por tenant, auditoria de acessos e acordos de confidencialidade com instituições. Registro de atividades para rastreabilidade.

(2) Priorização por IA — Risco: erro ou viés do modelo atrasar atendimento de casos graves. Estratégias: score com explicabilidade (motivos da priorização visíveis à equipe), decisão clínica sempre com humano (IA como suporte, não substituição), validação contínua no piloto com indicadores de segurança e ajuste do modelo. Protocolos com algoritmo de escalonamento para sintomas críticos usados em centros de referência em oncologia.

(3) Exclusão digital — Risco: pacientes sem smartphone ou sem acesso ao WhatsApp ficarem em desvantagem. Estratégias: uso do WhatsApp como canal principal por ser o mais difundido no Brasil, sem custo extra de dados para o paciente; a solução não substitui o atendimento presencial nem outros canais — a equipe mantém contato telefônico ou presencial quando necessário, conforme política da instituição.

(4) Dependência de infraestrutura — Risco: indisponibilidade de nuvem ou APIs afetar o cuidado. Estratégias: SLA com provedor de nuvem, monitoramento de disponibilidade, procedimentos de contingência e comunicação à equipe em caso de falha. Dados críticos com backup e plano de continuidade.

---

**Contagem:** ~1.450 caracteres (dentro do limite de 1500).

---

## 5. Descrição do mercado

**Limite no formulário:** 2000 caracteres  
**Pergunta:** Qual mercado sua solução/negócio pretende atingir?  
**Instruções:** Incluir: (a) tamanho e abrangência; (b) tendências; (c) estudos/testes; (d) concorrentes; (e) canais de venda; outras informações que destaquem o potencial de mercado.

### Texto para colar (≤2000 caracteres)

a) Tamanho e abrangência: Mercado nacional. Bottom-up: 704 mil casos/ano (INCA); 70% SUS, 30% privado. No SUS 80% sem navegação formal; no privado 50% já possuem. Estoque 5 anos: ~2,5 milhões. R$ 100/paciente/mês: TAM R$ 3,00 bi/ano (SUS R$ 2,37 bi; privado R$ 0,63 bi). Foco TAM SUS. 359 instituições (CACONs/UNACONs), clínicas e operadoras; expansão a partir do ES e Sudeste.

b) Tendências: Mercado em expansão. Aprovações legislativas: Lei 14.758/23 (Política Nacional do Câncer) e Portaria 6.592/2025 (Programa de Navegação no SUS). Tendência de pagamento pelo SUS e operadoras pela navegação como serviço (receita nova; nos EUA, CMS reembolsa desde 2024). Telemedicina e IA; WhatsApp com mais de 90% de penetração; healthtechs (R$ 2,1 bi em 2024). Regulação favorável à interoperabilidade (HL7/FHIR) e certificação de software.

c) Estudos e testes: Mais de 10 entrevistas com oncologistas e enfermeiros de navegação validando dores (coordenação, sobrecarga, readmissões) e interesse na solução. Piloto no HUCAM/UFES (Oncologia Urológica) para validação de efetividade e evidências; expansão prevista para outros serviços.

d) Concorrentes: WeCancer; sistemas proprietários de grandes conglomerados (Oncoclínica, Rede D'Or). Fragmentados: navegação predominantemente manual (planilhas, ligações); EHRs genéricos sem foco em jornada oncológica; telemedicina e chatbots não especializados. Nenhum concorrente direto combina navegação oncológica + priorização por IA + agente no WhatsApp em produto integrado.

e) Canais de venda: B2B direto a hospitais oncológicos, CACONs/UNACONs e clínicas; prospecção por indicação, eventos e associações oncológicas. Futuro: integradores de EHR e operadoras. Modelo SaaS por assinatura (instituição ou leito), com onboarding e suporte incluído.

Outras informações: 60-90 dias entre suspeita e tratamento reforça demanda por soluções que reduzam atrasos e readmissões. Potencial de replicação em outras especialidades após consolidação em oncologia.

---

**Contagem:** 2.000 caracteres (no limite).

---

## 6. Segmento de clientes (público-alvo)

**Limite no formulário:** 1500 caracteres  
**Pergunta:** Qual o público-alvo da sua solução/negócio?  
**Instruções:** Descreva: a) qual é o seu nicho de mercado (para quem sua empresa cria valor); b) quais são as necessidades e desejos do potencial cliente; c) quem são os clientes em potencial da solução; entre outras informações que evidenciem a demanda de mercado da sua solução. No caso de soluções voltadas para desafios socioambientais, detalhe qual o público que recebe as intervenções e quais outros públicos são potencialmente beneficiados.

### Texto para colar (≤1500 caracteres)

a) Nicho de mercado: Instituições que atendem câncer sem navegação formal ou que desejam ampliá-la com tecnologia. Valor para a instituição: coordenação entre especialidades; cumprimento da Lei dos 60 dias; redução de custos com diagnóstico e tratamento mais precoces (menos quimioterapia, radioterapia, terapias-alvo e imunobiológicos em estágios avançados; menos complicações com antibióticos, antifúngicos e internações em UTI); menor readmissão; produtividade da equipe. Valor para o paciente: jornada mais rápida, melhor qualidade do serviço em saúde e melhor prognóstico.

b) Necessidades e desejos do potencial cliente: Encurtar tempo entre suspeita e tratamento; coordenar especialistas e exames; reduzir sobrecarga da equipe (planilhas, ligações); cumprir Lei dos 60 dias e Programa de Navegação no SUS; ter visibilidade em tempo real da fila e dos casos críticos; reduzir custos de tratamento (quimio, rádio, terapias-alvo, imunobiológicos) e de complicações (antibióticos, antifúngicos, UTI) via diagnóstico e intervenção precoces; melhores indicadores hospitalares; oferecer melhor qualidade de cuidado e prognóstico ao paciente; e, onde aplicável, gerar receita com navegação como serviço.

c) Clientes em potencial: Hospitais públicos e filantrópicos com oncologia (CACONs, UNACONs); hospitais e clínicas privados; operadoras que queiram oferecer navegação aos beneficiários; depois, redes integradas e home care. Foco inicial: ES e Sudeste, com expansão nacional após piloto.

---

**Contagem:** ~1.459 caracteres (dentro do limite de 1500).

---

## 7. Modelo de Negócio — “De que forma a sua solução será monetizada?”

**Limite no formulário:** 1500 caracteres  
**Pergunta:** De que forma a sua solução será monetizada?  
**Instruções:** Descreva como o negócio irá gerar receita, destacando como os clientes irão pagar pela solução (preço fixo, mensalidade, taxa de uso, publicidade, assinatura, entre outras), o preço que será cobrado, de que maneira o público-alvo ficará sabendo da sua solução, escalabilidade, dentre outras informações que evidenciem a estratégia de vendas.

### Texto para colar (≤1500 caracteres)

Geração de receita: modelo SaaS com cobrança por uso. O cliente paga conforme o número de pacientes ativos em etapas pagas: diagnóstico, tratamento e seguimento. Pacientes em rastreio não são cobrados (uso gratuito). Não há mensalidade fixa mínima nem publicidade; a receita escala com o volume de pacientes atendidos.

Preço: (1) Taxa única de implementação com treinamento da equipe: R$ 10.000. (2) Recorrente: R$ 100 por paciente/mês, aplicado apenas a pacientes nas etapas de diagnóstico, tratamento ou seguimento; pacientes em rastreio sem custo. Faturamento mensal = número de pacientes ativos (etapas pagas) × R$ 100. Suporte técnico incluído na assinatura. Valores validados no piloto HUCAM/UFES.

Como o público-alvo fica sabendo: vendas diretas B2B a hospitais oncológicos, CACONs/UNACONs e clínicas; prospecção por indicação de gestores e associações oncológicas; participação em eventos e congressos da área; conteúdo e cases de uso (piloto HUCAM/UFES como caso de sucesso). Futuro: parcerias com integradores de prontuário (EHR) e operadoras para ampliar alcance.

Escalabilidade: arquitetura multi-tenant em nuvem; mesma infraestrutura atende múltiplos clientes sem custo marginal proporcional ao crescimento. Expansão por novos contratos (geográfica e por segmento) sem necessidade de deploy físico. Ciclo de vendas B2B típico de 3 a 6 meses; foco inicial ES e Sudeste, com replicação nacional após validação no piloto.

---

**Contagem:** ~1.441 caracteres (dentro do limite de 1500).

---

## 8. Gestão do negócio — “Como você pretende acompanhar o desempenho do seu negócio?”

**Limite no formulário:** 1000 caracteres  
**Pergunta:** Como você pretende acompanhar o desempenho do seu negócio?  
**Instruções:** Descreva detalhadamente como será organizada a gestão interna do seu negócio. Cite as principais métricas, processos e áreas na empresa que serão estruturadas para o desenvolvimento do negócio, bem como as ferramentas que serão utilizadas.

### Texto para colar (≤1000 caracteres)

Métricas principais: receita recorrente mensal (pacientes ativos em etapas pagas × R$ 100); receita com implementação (taxa única R$ 10.000); número de clientes ativos e de pacientes navegados; CAC (custo de aquisição por cliente), LTV (valor do cliente ao longo do tempo) por cliente e razão LTV/CAC (métrica de saúde do negócio); churn (cancelamentos); tempo médio até primeiro valor (onboarding); NPS ou satisfação do cliente; indicadores de uso da plataforma (etapas concluídas, alertas acionados) para validar valor entregue.

Processos: ciclo construir-medir-aprender (hipóteses testadas com dados de uso e resultado antes de escalar); pipeline de vendas (qualificação, proposta, fechamento; ciclo 3-6 meses); prioridade à retenção e ao valor entregue antes de acelerar aquisição; onboarding e treinamento com padrão documentado; suporte e sucesso do cliente; desenvolvimento de produto com backlog priorizado e experimentos rápidos; gestão financeira (faturamento, unit economics). Decisões baseadas em evidências e métricas de aprendizado validado; revisão periódica para perseverar ou ajustar rumo.

Áreas estruturadas: produto e tecnologia; vendas e distribuição (canal como vantagem); operações e suporte; financeiro e administrativo. Foco em uma proposta de valor defensável e em melhoria contínua orientada ao valor em saúde (resultado para instituição e paciente).

Ferramentas: dashboard de métricas de inovação e negócio (receita, LTV/CAC, retenção, ativação, uso); CRM ou planilhas para pipeline; monitoramento da plataforma; reuniões de acompanhamento com foco em aprendizado e prioridades.

---

**Contagem:** ~1.298 caracteres (acima do limite de 1000; versão resumida abaixo).

---

### Texto para colar — versão ≤1000 caracteres

Métricas: receita recorrente e de implementação (R$ 10.000); clientes e pacientes navegados; CAC, LTV por cliente e LTV/CAC (saúde do negócio); churn; retenção e ativação; tempo até primeiro valor; NPS; indicadores de uso para aprendizado validado (valor entregue).

Processos: ciclo construir-medir-aprender; prioridade à retenção e ao valor entregue antes de escalar aquisição; pipeline de vendas (3-6 meses); onboarding e treinamento; suporte e sucesso do cliente; produto com experimentos rápidos; gestão financeira (unit economics). Decisões baseadas em evidências; revisão periódica para perseverar ou ajustar.

Áreas: produto e tecnologia; vendas e distribuição; operações e suporte; financeiro. Foco em proposta de valor defensável e melhoria contínua orientada ao valor em saúde.

Ferramentas: Inicialmente com notion e slack e posterior sistema proprietário; dashboard (receita, LTV/CAC, retenção, ativação, uso); CRM ou planilhas; monitoramento da plataforma; reuniões de acompanhamento com foco em aprendizado e feedback do cliente.

---

**Contagem:** 918 caracteres (dentro do limite de 1000).

---

## 9. Cronograma físico de atividades — Desenvolvimento do Produto e do Negócio

**Instruções do formulário:** Elaborar o cronograma físico de desenvolvimento do produto e negócio para **12 meses**. Detalhar etapas e atividades com **indicadores reais** que guiarão a execução. Até **10 etapas**, com até **5 atividades principais** por etapa. Para cada atividade: Nome, Descrição, Indicadores, Início (DD/MM/AAAA), Fim (DD/MM/AAAA). Objetivos alcançáveis; todas as atividades planejadas deverão ser executadas.

**Estágio atual e meta em 12 meses:**  

- **Etapa atual:** Apresentação da versão inicial para o cliente; **Protótipo beta** — solução sendo testada/validada em ambiente controlado (grupo de usuários reais ou potenciais), ainda não lançada ao público.  
- **Meta ao final dos 12 meses:** **Comercialização pioneira** — solução final no mercado com algumas vendas realizadas e buscando a venda de um lote pioneiro.

O cronograma leva o projeto **do protótipo beta** até a **comercialização pioneira** em 12 meses: (1) formalização e execução do piloto institucional HUCAM para validação científica; (2) evolução do protótipo para ambiente de piloto e depois para produção; (3) geração de evidências; (4) primeiras vendas e operação do lote pioneiro.

**Período de planejamento:** 12 meses.  
**Data de início sugerida:** 01/06/2026 (ajustar à data de assinatura do contrato com a FAPES — contratação prevista no edital 18/2025: 16/05/2026 a 15/09/2026).

---

### Etapa 1 — Preparação e governança do piloto HUCAM

**Início:** 01/06/2026 | **Fim:** 30/06/2026

*Solução em estágio de protótipo beta (versão inicial apresentada ao cliente, validação em ambiente controlado); foco em formalizar o piloto institucional e a pesquisa para evoluir ao estágio de comercialização.*


| #   | Nome da Atividade                     | Descrição da Atividade                                                                                                                                | Indicadores da atividade                                        | Início     | Fim        |
| --- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------- | ---------- |
| 1   | Formalizar parceria HUCAM/UFES        | Assinatura de termo de cooperação e acordos de confidencialidade com HUCAM/UFES para o piloto no Serviço de Oncologia Urológica.                      | Acordo formal assinado; documento de confidencialidade vigente. | 01/06/2026 | 15/06/2026 |
| 2   | Submeter projeto ao Comitê de Ética   | Submissão do protocolo do estudo piloto ao CEP (Comitê de Ética em Pesquisa) para coorte pré/pós e coleta de dados.                                   | Protocolo submetido; aprovação CEP obtida (número do parecer).  | 01/06/2026 | 30/06/2026 |
| 3   | Adequar ambientes e backlog ao piloto | Adequação dos ambientes de desenvolvimento e homologação ao piloto HUCAM; priorização do backlog para sair do beta e atender ao piloto institucional. | Ambientes adequados ao piloto; backlog priorizado documentado.  | 05/06/2026 | 25/06/2026 |
| 4   | Kick-off e metas do projeto Centelha  | Reunião de alinhamento com a equipe e parceiros sobre metas do projeto Centelha (piloto, evidências, lote pioneiro) e indicadores dos 12 meses.       | Ata de kick-off; metas e responsáveis definidos.                | 15/06/2026 | 30/06/2026 |


---

### Etapa 2 — Adequações para o piloto e conformidade

**Início:** 01/07/2026 | **Fim:** 31/08/2026

*Protótipo beta em validação; preparar infraestrutura, integrações e conformidade para transição do ambiente controlado ao piloto institucional HUCAM.*


| #   | Nome da Atividade                             | Descrição da Atividade                                                                                                                           | Indicadores da atividade                                                               | Início     | Fim        |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ---------- | ---------- |
| 1   | Conformidade LGPD e documentação de segurança | Revisão e documentação da arquitetura sob ótica LGPD (criptografia, acesso, auditoria); checklist de conformidade aprovado para o piloto.        | Checklist LGPD preenchido e aprovado; documentação de segurança atualizada.            | 01/07/2026 | 20/07/2026 |
| 2   | Adequar integrações ao fluxo HUCAM            | Adequação e testes das integrações (WhatsApp Business API, APIs) ao fluxo do Serviço de Oncologia Urológica (HUCAM) para o piloto institucional. | Integrações validadas para o piloto; testes de aceitação aprovados.                    | 01/07/2026 | 31/08/2026 |
| 3   | Monitoramento e alertas da plataforma         | Revisão/consolidação de monitoramento de disponibilidade, erros e desempenho; alertas para a equipe técnica.                                     | Dashboards de monitoramento ativos; procedimento de resposta a incidentes documentado. | 10/07/2026 | 25/07/2026 |
| 4   | Testes de carga e disponibilidade             | Execução de testes de carga e disponibilidade da plataforma em ambiente de homologação, garantindo prontidão para o piloto.                      | Relatório de testes com resultados (disponibilidade, tempo de resposta).               | 15/08/2026 | 31/08/2026 |


---

### Etapa 3 — Evolução do protótipo beta para o piloto institucional

**Início:** 01/08/2026 | **Fim:** 31/10/2026

*Sair do estágio de protótipo beta: finalizar e estabilizar dashboard, modelo de priorização e agente WhatsApp para uso em ambiente real no piloto HUCAM (validação científica).*


| #   | Nome da Atividade                               | Descrição da Atividade                                                                                                                                     | Indicadores da atividade                                                     | Início     | Fim        |
| --- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------- | ---------- |
| 1   | Finalizar dashboard e fluxos de navegação       | Conclusão e estabilização do dashboard (rastreamento em tempo real, etapas, filas) e dos fluxos de uso pela equipe de enfermagem e gestores para o piloto. | Releases entregues; funcionalidades validadas com usuários.                  | 01/08/2026 | 30/09/2026 |
| 2   | Estabilizar modelo de priorização (XGBoost)     | Finalização e calibração do modelo de priorização (score 0–100) com explicabilidade para a equipe clínica do HUCAM.                                        | Modelo calibrado; métricas de acurácia e explicabilidade documentadas.       | 01/08/2026 | 15/10/2026 |
| 3   | Estabilizar agente conversacional no WhatsApp   | Finalização dos fluxos do agente de IA no WhatsApp: coleta de dados clínicos, detecção de sintomas críticos, RAG em guidelines oncológicos.                | Cobertura de intents definida; testes de conversação e satisfação (amostra). | 15/08/2026 | 31/10/2026 |
| 4   | Alertas automáticos e regras de negócio         | Implementação e validação dos alertas automáticos (risco, perda de seguimento, etapas atrasadas) e regras de negócio da navegação para o piloto.           | Alertas ativos em homologação; validação com equipe clínica.                 | 01/09/2026 | 25/10/2026 |
| 5   | Testes de usabilidade e aceitação para o piloto | Testes de usabilidade com usuários reais (enfermagem/gestores) e critérios de aceitação para lançamento no piloto HUCAM.                                   | Relatório de usabilidade; critérios de aceitação atendidos.                  | 15/10/2026 | 31/10/2026 |


---

### Etapa 4 — Integração e piloto HUCAM

**Início:** 01/09/2026 | **Fim:** 30/11/2026

*Primeira operação em ambiente institucional real (piloto HUCAM): transição do protótipo beta validado em ambiente controlado para validação científica com usuários e pacientes reais.*


| #   | Nome da Atividade                  | Descrição da Atividade                                                                                                    | Indicadores da atividade                                                | Início     | Fim        |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------- | ---------- |
| 1   | Deploy no ambiente do piloto       | Deploy da plataforma no ambiente de produção do piloto HUCAM (Oncologia Urológica) e validação de conectividade e fluxos. | Ambiente em produção; acesso validado pela equipe HUCAM.                | 01/09/2026 | 20/09/2026 |
| 2   | Treinamento da equipe HUCAM        | Treinamento da equipe de Oncologia Urológica (enfermagem, gestores) no uso da plataforma e dos fluxos de navegação.       | Número de participantes treinados; material de treinamento entregue.    | 15/09/2026 | 05/10/2026 |
| 3   | Inclusão de pacientes no piloto    | Inclusão de pacientes no piloto conforme critérios do estudo aprovado no CEP (coorte pré/pós).                            | Número de pacientes incluídos; critérios de elegibilidade documentados. | 01/10/2026 | 30/11/2026 |
| 4   | Coleta contínua de dados           | Coleta contínua de dados do piloto: tempos de etapa, conclusão de etapas, alertas acionados, uso do agente WhatsApp.      | Base de dados atualizada; indicadores de navegação calculados.          | 01/10/2026 | 30/11/2026 |
| 5   | Acompanhamento quinzenal com HUCAM | Reuniões quinzenais de acompanhamento com a equipe HUCAM para feedback, ajustes e ações corretivas.                       | Atas de reunião; ações acordadas implementadas.                         | 01/10/2026 | 30/11/2026 |


---

### Etapa 5 — Validação e refinamento

**Início:** 01/10/2026 | **Fim:** 31/12/2026


| #   | Nome da Atividade                         | Descrição da Atividade                                                                                       | Indicadores da atividade                                                         | Início     | Fim        |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ---------- | ---------- |
| 1   | Ajustes de produto a partir do piloto     | Implementação de ajustes de produto identificados no piloto (backlog de melhorias, correções, novas regras). | Backlog de ajustes executado (número de itens concluídos).                       | 01/11/2026 | 31/12/2026 |
| 2   | Validação de usabilidade e satisfação     | Aplicação de survey ou NPS de usabilidade e satisfação da equipe do HUCAM com a plataforma.                  | Relatório de satisfação; NPS ou score médio documentado.                         | 15/11/2026 | 15/12/2026 |
| 3   | Calibração do modelo com dados reais      | Calibração do modelo de priorização (XGBoost) com dados reais do piloto; métricas de acurácia e segurança.   | Métricas de acurácia documentadas; modelo em produção atualizado.                | 01/11/2026 | 20/12/2026 |
| 4   | Documentação para expansão                | Elaboração de documentação de processos, manuais e runbooks para replicação em outros serviços/instituições. | Manuais ou runbooks publicados internamente; processo de onboarding documentado. | 15/11/2026 | 31/12/2026 |
| 5   | Preparação de evidências para publicações | Organização dos dados e redação de rascunhos para submissão de artigo(s) científico(s) sobre o piloto.       | Rascunho(s) de artigo preparado(s); plano de submissão definido.                 | 01/12/2026 | 31/12/2026 |


---

### Etapa 6 — Pesquisa e evidências

**Início:** 01/11/2026 | **Fim:** 28/02/2027


| #   | Nome da Atividade                            | Descrição da Atividade                                                                                                               | Indicadores da atividade                                              | Início     | Fim        |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ---------- | ---------- |
| 1   | Análise estatística do piloto                | Análise estatística dos dados do piloto (tempo até diagnóstico/tratamento, etapas concluídas, readmissões quando aplicável).         | Relatório de resultados com indicadores e comparação pré/pós.         | 01/12/2026 | 31/01/2027 |
| 2   | Submissão de artigo científico               | Redação final e submissão de artigo científico a periódico da área (oncologia, saúde digital ou enfermagem).                         | Artigo submetido; comprovante de submissão.                           | 15/01/2027 | 28/02/2027 |
| 3   | Apresentação em evento científico ou técnico | Apresentação dos resultados do piloto em congresso, seminário ou evento técnico (presencial ou online).                              | Apresentação realizada; comprovante (certificado ou programa).        | 01/01/2027 | 28/02/2027 |
| 4   | Painel de indicadores de impacto             | Consolidação dos indicadores de impacto (tempo até diagnóstico, readmissões, uso da plataforma) em painel para gestores e parceiros. | Painel de indicadores disponível; métricas validadas.                 | 15/12/2026 | 15/02/2027 |
| 5   | Avaliação de enquadramento ANVISA            | Avaliação interna de enquadramento na RDC ANVISA (SaMD) e documentação para eventual registro futuro.                                | Parecer interno ou documento de avaliação; próximos passos definidos. | 01/02/2027 | 28/02/2027 |


---

### Etapa 7 — Comercialização e primeiras vendas (rumo ao lote pioneiro)

**Início:** 01/12/2026 | **Fim:** 28/02/2027

*Com o piloto HUCAM e as evidências em andamento, iniciar a etapa comercial: primeiras vendas e estruturação para alcançar o estágio de comercialização pioneira (solução no mercado com vendas e lote pioneiro).*


| #   | Nome da Atividade                           | Descrição da Atividade                                                                                                       | Indicadores da atividade                                                | Início     | Fim        |
| --- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------- | ---------- |
| 1   | Materiais comerciais e caso HUCAM           | Elaboração de materiais comerciais (apresentação, one-pager, caso de uso) com resultados e depoimentos do piloto HUCAM.      | Kit comercial pronto; caso de uso HUCAM documentado.                    | 01/12/2026 | 20/01/2027 |
| 2   | Pipeline de vendas e CRM                    | Estruturação do pipeline de vendas (qualificação, proposta, fechamento) e uso de CRM ou planilhas para acompanhamento.       | Pipeline com oportunidades cadastradas; processo de vendas documentado. | 15/12/2026 | 31/01/2027 |
| 3   | Prospecção CACONs/UNACONs e hospitais       | Prospecção ativa de CACONs, UNACONs e hospitais oncológicos no ES e Sudeste (reuniões, demos, visitas).                      | Número de reuniões/demos realizadas; leads qualificados.                | 01/01/2027 | 28/02/2027 |
| 4   | Primeiro cliente pago ou carta de intenção  | Fechamento do primeiro cliente pago (pós-piloto) ou assinatura de carta de intenção (LOI) com instituição interessada.       | 1 contrato assinado ou 1 LOI formalizada.                               | 01/01/2027 | 28/02/2027 |
| 5   | Processo de onboarding e sucesso do cliente | Definição e documentação do processo de onboarding (implementação, treinamento) e de sucesso do cliente (suporte, métricas). | Playbook de onboarding e sucesso do cliente documentado.                | 15/01/2027 | 28/02/2027 |


---

### Etapa 8 — Operação, sucesso do cliente e consolidação (comercialização pioneira)

**Início:** 01/02/2027 | **Fim:** 31/05/2027

*Consolidação dos primeiros clientes e operação do lote pioneiro; ao final dos 12 meses, atingir o estágio de comercialização pioneira (solução no mercado com vendas realizadas e busca do lote pioneiro).*


| #   | Nome da Atividade                     | Descrição da Atividade                                                                                           | Indicadores da atividade                                                           | Início     | Fim        |
| --- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------- | ---------- |
| 1   | Onboarding e go-live de cliente(s)    | Execução do onboarding e colocação em produção do(s) primeiro(s) cliente(s) pago(s) conforme playbook.           | Cliente(s) ativo(s) em produção; go-live concluído.                                | 01/03/2027 | 30/04/2027 |
| 2   | Suporte e métricas de uso e retenção  | Acompanhamento de suporte, métricas de uso da plataforma, retenção e NPS dos clientes ativos.                    | Dashboards de uso e retenção atualizados; ações de sucesso do cliente registradas. | 01/02/2027 | 31/05/2027 |
| 3   | Unit economics e precificação         | Revisão de unit economics (CAC, LTV, LTV/CAC) e de precificação com base nos dados dos primeiros clientes.       | Relatório de unit economics; precificação revisada (se aplicável).                 | 01/04/2027 | 15/05/2027 |
| 4   | Documentação para certificação futura | Atualização da documentação de processos e qualidade para futura certificação (ISO, ANVISA), conforme planejado. | Documentação de qualidade atualizada; checklist de certificação preenchido.        | 15/03/2027 | 31/05/2027 |
| 5   | Planejamento do próximo ciclo         | Elaboração do roadmap e do plano de execução para os 12 meses seguintes (produto, vendas, operação).             | Roadmap do próximo ciclo aprovado pela equipe.                                     | 15/05/2027 | 31/05/2027 |


---

### Resumo para o formulário

- **Etapa atual:** Apresentação da versão inicial para o cliente; protótipo beta (solução testada/validada em ambiente controlado, ainda não lançada ao público).  
- **Meta em 12 meses:** Comercialização pioneira (solução final no mercado com algumas vendas realizadas e buscando venda de lote pioneiro).  
- **Total de etapas:** 8 (dentro do limite de 10).  
- **Total de atividades:** 33 (todas com até 5 atividades por etapa).  
- **Período:** 01/06/2026 a 31/05/2027 (12 meses).  
- **Ajuste:** As datas de início e fim devem ser conferidas e, se necessário, ajustadas à data de assinatura do contrato com a FAPES.

Ao preencher o formulário, use para cada **Atividade** os campos: **Nome da Atividade**, **Descrição da Atividade**, **Indicadores da atividade**, **Início** (DD/MM/AAAA), **Fim** (DD/MM/AAAA), conforme as tabelas acima.

---

## 11. Equipe

**Limite no formulário:** 500 caracteres  

### Campo: Constituição da equipe executora (um único texto, 500 caracteres)

**Perguntas do formulário:**  

1. A equipe executora domina plenamente as tecnologias necessárias para o desenvolvimento da solução?
2. Descreva como está constituída a equipe que atua ou atuará no projeto. Descreva o time de sócios e colaboradores em ordem de relevância para o negócio. Considere a equipe atual do projeto, parcerias para a execução da proposta e demais atores envolvidos com a execução do projeto.

### Texto para colar (≤500 caracteres)

Sim. A equipe domina as tecnologias: stack em uso (Next.js, NestJS, Python FastAPI, PostgreSQL), IA/ML e WhatsApp em produção em outros projetos. Constituição, por relevância: Luiz (CEO)—medicina UFES, IA/WhatsApp, gestão; Pedro (CTO)—Eng. Computação TU Delft, full-stack; Gabriel—UFSCar, ML em produção. Parceria HUCAM/UFES para piloto em Oncologia Urológica. Equipe atual e parceria cobrem produto, tecnologia e validação clínica.

**Contagem:** 452 caracteres.

---

### Versões alternativas (se o formulário permitir mais caracteres)

**Versão 1 pessoa — 811 caracteres**

Formação médica (UFES, 4º ano) com conhecimento profundo do problema oncológico. Experiência técnica comprovada em agentes de IA conversacionais integrados ao WhatsApp (projeto FgtsAgent em fase final), demonstrando capacidade de execução em tecnologias similares. Experiência em gestão de performance (Turbo Partners, 1 ano) com foco em otimização de processos, competência essencial para desenvolver soluções que gerem ROI mensurável. Conhecimento avançado em mercado financeiro, permitindo validação de viabilidade econômica e modelagem de negócio SaaS. Combinação única de conhecimento médico, expertise técnica (agentes de IA, WhatsApp API) e experiência em gestão, alinhada com paixão por inovações em saúde. Projeto anterior demonstra capacidade de desenvolver e entregar soluções tecnológicas complexas.

**Contagem:** 811 caracteres.

---

**Versão 3 membros — 998 caracteres**

Luiz (CEO): Formação médica (UFES, 4º ano), conhecimento profundo do problema oncológico. Experiência em agentes de IA e WhatsApp (FgtsAgent). Gestão de performance (Turbo Partners), otimização e ROI mensurável.

Pedro (CTO): Eng. Computação (TU Delft). Full-stack Sênior (Upwork): sistemas >99,9% uptime, 100M+ registros, lançamentos +$5M/ano. Arquitetura escalável e alta performance.

Gabriel (Cientista de Dados): Ciência da Computação (UFSCar). Cientista de Dados JR (Bradesco, RD Saúde): ML em produção, séries temporais, NLP. Projetos: pricing, otimização de entregas.

Combinação: conhecimento médico (Luiz) + sistemas escaláveis (Pedro) + ML/dados (Gabriel) + gestão orientada a resultados. Experiência comprovada em tecnologias similares e soluções B2B em saúde.

**Contagem:** 998 caracteres.

**Versões alternativas (outros campos ou editais):** As versões abaixo podem ser usadas em campos como “Por que você e sua equipe são as pessoas certas?” ou quando o limite for maior. As de 811 e 998 caracteres descrevem a equipe completa com mais detalhe.

---

## 12. Domínio da tecnologia

**Limite no formulário:** 500 caracteres  
**Pergunta:** Existem conhecimentos-chave, tecnologias de suporte ou know-how que possam ser considerados elementos essenciais para o sucesso da solução proposta?  
**Instruções:** Descrever os fatores essenciais para o desenvolvimento da solução, em termos de domínio tecnológico, que impactam diretamente na transformação da proposta em um negócio. Citar parcerias já firmadas com laboratórios, universidades, empresas, entre outros, que apoiarão o desenvolvimento da inovação e são indispensáveis para a produção tecnológica.

### Texto para colar (≤500 caracteres)

Conhecimentos-chave: priorização por IA (XGBoost), agentes com LLM e RAG em guidelines (NCCN, ASCO), WhatsApp Business API, SaaS multi-tenant, HL7/FHIR e LGPD. Navegação oncológica e fluxos clínicos. Parceria firmada com HUCAM/UFES para piloto em Oncologia Urológica, indispensável para validação e evidências. Stack (Next.js, NestJS, Python FastAPI, PostgreSQL); equipe com experiência em IA, WhatsApp e ML em produção permite transformar a proposta em negócio.

**Contagem:** 477 caracteres.

---

## Próximos blocos (a preencher em sequência)


| #   | Bloco                                                         | Limite                                 | Status             |
| --- | ------------------------------------------------------------- | -------------------------------------- | ------------------ |
| 0   | Resumo do negócio                                             | 500                                    | ✅ Preenchido acima |
| 1   | Descrição da solução (“Qual é a solução desenvolvida?”)       | 2000                                   | ✅ Preenchido acima |
| 2   | Estratégia de desenvolvimento do produto/solução              | 1500                                   | ✅ Preenchido acima |
| 3   | Impacto socioambiental (ações que geram impactos positivos)   | 1500                                   | ✅ Preenchido acima |
| 4   | Impactos negativos e estratégias de mitigação                 | 1500                                   | ✅ Preenchido acima |
| 5   | Descrição do mercado                                          | 2000                                   | ✅ Preenchido acima |
| 6   | Segmento de clientes (público-alvo)                           | 1500                                   | ✅ Preenchido acima |
| 7   | Modelo de Negócio (“De que forma a solução será monetizada?”) | 1500                                   | ✅ Preenchido acima |
| 8   | Gestão do negócio (acompanhamento do desempenho)              | 1000                                   | ✅ Preenchido acima |
| 9   | **Cronograma físico de atividades** (produto e negócio)       | 12 meses, até 10 etapas × 5 atividades | ✅ Preenchido acima |
| 10  | Diferenciais da solução                                       | ≤1000                                  | Pendente           |
| 11  | Constituição da equipe executora                              | 500                                    | ✅ Preenchido acima |


*(Outros campos do formulário serão adicionados conforme avançarmos.)*