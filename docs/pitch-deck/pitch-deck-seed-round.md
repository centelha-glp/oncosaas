# Pitch Deck - Seed Round (R$ 2M)

## Slide 1: Capa

**Título**: Plataforma de Otimização de Processos Oncológicos

**Tagline**: Inteligência Artificial para navegação, priorização e acompanhamento remoto de pacientes oncológicos

**Logo da Empresa**

**Data**: 2024

---

## Slide 2: Problema

### O Desafio na Oncologia Brasileira

**Estatísticas**:

- 700.000 novos casos de câncer/ano no Brasil
- Tempo médio de diagnóstico: 3-6 meses (muito longo)
- Taxa de readmissão: 20-30% (evitável)
- Falta de coordenação entre especialidades
- Sobrecarga da equipe de enfermagem

**Dores Principais**:

1. **Falta de visibilidade**: Não se sabe onde cada paciente está na jornada
2. **Priorização manual**: Casos críticos podem ser perdidos
3. **Coleta de dados fragmentada**: Informações em múltiplos sistemas
4. **Sobrecarga de enfermagem**: Muitas ligações telefônicas de acompanhamento
5. **Atrasos no diagnóstico**: Falta de coordenação

**Custo**:

- R$ 50-100k por readmissão evitável
- Perda de receita por ociosidade de equipamentos
- Custo de coordenação manual: 30% do tempo da equipe

---

## Slide 3: Solução

### Plataforma SaaS com IA

**3 Pilares**:

1. **Navegação Inteligente**
   - Dashboard centralizado da jornada do paciente
   - Visibilidade completa em tempo real

2. **Priorização com IA**
   - Score automático de prioridade (0-100)
   - Identifica casos que precisam atenção imediata
   - Explicabilidade do score

3. **Acompanhamento Remoto via WhatsApp**
   - Agente de IA conversa com pacientes
   - Coleta dados de sintomas e qualidade de vida
   - Detecta sintomas críticos → alerta enfermagem
   - Dashboard para enfermagem monitorar e intervir

**Diferencial**:

- WhatsApp (sem necessidade de app)
- IA conversacional (coleta natural)
- Priorização inteligente (não manual)
- Integração com EHRs existentes

---

## Slide 4: Como Funciona

### Fluxo da Solução

```
1. Paciente é registrado no sistema (via EHR)
   ↓
2. Agente WhatsApp inicia conversa semanal
   ↓
3. Coleta sintomas de forma conversacional
   ↓
4. IA detecta sintoma crítico?
   SIM → Alerta enfermagem em tempo real
   ↓
5. Enfermagem monitora no dashboard
   ↓
6. Intervém se necessário (assume conversa)
   ↓
7. Dados sincronizados com EHR
   ↓
8. Score de priorização atualizado automaticamente
```

**Benefícios**:

- Menos ligações telefônicas (40% de redução)
- Detecção precoce de complicações
- Priorização automática (não manual)
- Coordenação centralizada

---

## Slide 5: Tecnologia e IA

### Stack Tecnológico

**Frontend**: Next.js 15 (React 19 + TypeScript)

**Backend**: NestJS (Node.js + TypeScript)

**IA/ML**:

- LLM: GPT-4 ou Claude (agente conversacional)
- ML: LightGBM (priorização de casos)
- RAG: Base de conhecimento médico (guidelines NCCN, ASCO)
- STT: Google Cloud Speech-to-Text (áudios WhatsApp)

**Integração**: HL7/FHIR (EHRs existentes)

**Segurança**:

- Criptografia AES-256
- LGPD compliant
- Multi-tenant isolado

**WhatsApp Business API**: Integração oficial

---

## Slide 6: Mercado

### TAM, SAM, SOM

**TAM (Total Addressable Market)**:

- Mercado de saúde digital no Brasil: R$ 15 bilhões (2024)
- Crescimento: 20% ao ano

**SAM (Serviceable Addressable Market)**:

- Hospitais oncológicos no Brasil: ~500
- Clínicas oncológicas: ~2.000
- Potencial: 2.500 clientes

**SOM (Serviceable Obtainable Market)**:

- Meta 3 anos: 50-100 clientes
- Receita potencial: R$ 15-30M/ano

**Tendências**:

- Telemedicina crescente (pós-COVID)
- IA em saúde: mercado em expansão
- WhatsApp Business: >500M usuários no Brasil
- Foco em eficiência e redução de custos

---

## Slide 7: Modelo de Negócio

### SaaS B2B

**Pricing**:

- **Tier 1**: Até 100 pacientes/mês - R$ 5.000/mês
- **Tier 2**: 101-500 pacientes/mês - R$ 15.000/mês
- **Tier 3**: 500+ pacientes/mês - R$ 30.000/mês + R$ 30/paciente adicional
- **Setup**: Taxa única R$ 20.000 (integração)

**Unit Economics**:

- **CAC**: R$ 15.000 (ciclo 3-6 meses)
- **LTV**: R$ 180.000 (3 anos, cliente médio)
- **LTV:CAC**: 12:1
- **Churn**: 5-10% ao ano (saúde = alta retenção)

**Custos Variáveis**:

- WhatsApp API: ~R$ 2-3/paciente/mês
- APIs de IA: ~R$ 10-15/paciente/mês
- **Total**: ~R$ 13-20/paciente/mês

---

## Slide 8: ROI para Clientes

### Economia e Eficiência

**Redução de Custos**:

- **Readmissões evitáveis**: 20-30% de redução
  - Economia: R$ 500k-1M/ano (hospital médio)
- **Ociosidade de equipamentos**: Redução de 15%
  - Economia: R$ 200k-500k/ano
- **Eficiência da equipe**: 15% de aumento
  - Economia: R$ 300k-600k/ano

**ROI Estimado**:

- **Investimento**: R$ 15k/mês (R$ 180k/ano)
- **Economia**: R$ 1M-2M/ano
- **ROI**: 5-10x em 1 ano
- **Payback**: 2-3 meses

**Outros Benefícios**:

- Satisfação do paciente (+20%)
- Redução de tempo de diagnóstico (30% mais rápido)
- Qualidade de dados (coleta contínua)

---

## Slide 9: Tração e Validação

### Validação do Produto

**Product Discovery**:

- 10+ entrevistas com oncologistas, enfermeiros e gestores
- Dores validadas: falta de coordenação, priorização manual, sobrecarga
- Features priorizadas: navegação, priorização IA, agente WhatsApp

**Pilotos Planejados**:

- 3-5 hospitais oncológicos (Q2 2024)
- Duração: 3-6 meses
- Validação de valor e ROI

**Métricas Esperadas**:

- Taxa de resposta ao agente: ≥60%
- Detecção de sintomas críticos: ≥90%
- Redução de readmissões: 20-30%
- Satisfação (NPS): ≥50

**Parcerias**:

- Integradores de EHR (em negociação)
- Associações oncológicas (em contato)

---

## Slide 10: Roadmap

### Próximos 18 Meses

**Fase 1: MVP (6 meses)**

- Navegação + Priorização + Agente WhatsApp
- Dashboard para enfermagem
- Integração com 1-2 EHRs
- 3-5 clientes piloto

**Fase 2: Validação (6 meses)**

- Escalar para 20-30 clientes
- RAG para suporte à decisão
- Analytics avançado
- Integração com mais EHRs

**Fase 3: Crescimento (6 meses)**

- 50-100 clientes
- Expansão para outros tipos de câncer
- Parcerias com planos de saúde
- Certificação ANVISA (SaMD)

---

## Slide 11: Equipe

### Time Fundador

**[Nome do CEO] - CEO**

- Background: [X anos em saúde/tech]
- Experiência: [Startups anteriores, healthcare]

**[Nome do CTO] - CTO**

- Background: [X anos em tech/IA]
- Experiência: [Sistemas de saúde, IA]

**[Nome do CMO] - CMO**

- Background: [X anos em vendas B2B]
- Experiência: [Saúde, enterprise sales]

**Advisors**:

- [Nome] - Oncologista (Validação clínica)
- [Nome] - Healthtech (Estratégia)
- [Nome] - Compliance (LGPD/ANVISA)

---

## Slide 12: Fundraising

### Seed Round: R$ 2M

**Uso dos Recursos**:

- **Produto (40%)**: R$ 800k
  - Desenvolvimento MVP
  - IA e ML
  - Integrações
- **Vendas e Marketing (30%)**: R$ 600k
  - Equipe de vendas
  - Marketing de conteúdo
  - Pilotos
- **Compliance e Legal (15%)**: R$ 300k
  - LGPD, ANVISA
  - Contratos, seguros
- **Operações (15%)**: R$ 300k
  - Infraestrutura
  - Runway (18-24 meses)

**Milestones**:

- 6 meses: MVP lançado, 3-5 pilotos
- 12 meses: 20-30 clientes, R$ 300k MRR
- 18 meses: 50-100 clientes, R$ 1M MRR

**Next Round**: Série A (R$ 10-15M) em 18-24 meses

---

## Slide 13: Concorrência

### Diferenciais Competitivos

**Concorrentes**:

- **Sistemas de navegação**: Apenas navegação, sem IA
- **EHRs**: Complexos, não focados em oncologia
- **Telemedicina**: Não específico para oncologia, sem priorização

**Nosso Diferencial**:

1. **IA Conversacional**: WhatsApp (sem app)
2. **Priorização Inteligente**: Não manual
3. **Foco em Oncologia**: Especializado
4. **Integração**: Funciona com EHRs existentes
5. **Acompanhamento Remoto**: Coleta contínua de dados

**Barreiras de Entrada**:

- Expertise em IA médica
- Integração complexa com EHRs
- Compliance (LGPD, ANVISA)
- Relacionamento com hospitais

---

## Slide 14: Riscos e Mitigações

### Principais Riscos

**Risco 1**: Resistência de médicos a usar novo sistema

- **Mitigação**: Onboarding robusto, treinamento, suporte

**Risco 2**: Integração complexa com EHRs

- **Mitigação**: Parcerias com integradores, suporte técnico

**Risco 3**: Compliance regulatório

- **Mitigação**: Consultoria desde o início, validação jurídica

**Risco 4**: Agente de IA com respostas inadequadas

- **Mitigação**: Guardrails rigorosos, supervisão humana, testes extensivos

**Risco 5**: Custos de APIs de IA

- **Mitigação**: Otimização de prompts, considerar modelos open-source

---

## Slide 15: Visão

### Onde Queremos Estar em 5 Anos

**Missão**: Transformar o cuidado oncológico através de IA, tornando-o mais eficiente, coordenado e centrado no paciente.

**Visão 2029**:

- **300+ hospitais/clínicas** usando a plataforma
- **100.000+ pacientes** sendo acompanhados
- **Expansão internacional** (América Latina)
- **Múltiplos tipos de câncer** (mama, pulmão, colorretal, próstata, etc.)
- **Parcerias estratégicas** com planos de saúde e laboratórios
- **Líder de mercado** em navegação e acompanhamento oncológico

**Impacto**:

- Redução de 30% em readmissões
- Redução de 40% em tempo de diagnóstico
- Melhoria de 25% em satisfação do paciente
- Economia de R$ 500M+ em custos evitáveis

---

## Slide 16: Call to Action

### Junte-se a Nós

**Oportunidade**:

- Mercado de R$ 15 bilhões em crescimento
- Problema crítico e validado
- Solução inovadora com IA
- ROI claro para clientes (5-10x)

**O Que Estamos Buscando**:

- Investidores que compartilham nossa visão
- Expertise em healthtech/enterprise SaaS
- Conexões com hospitais/clínicas
- Suporte estratégico

**Próximos Passos**:

1. MVP em 6 meses
2. Primeiros clientes piloto
3. Validação de mercado
4. Crescimento acelerado

**Contato**:

- Email: [email]
- Website: [website]
- LinkedIn: [linkedin]

---

## Apêndice: Métricas Detalhadas

### Financial Model (Ano 1)

**Receita**:

- Q1: R$ 0 (desenvolvimento)
- Q2: R$ 30k (1 piloto)
- Q3: R$ 90k (3 clientes)
- Q4: R$ 180k (6 clientes)
- **Total Ano 1**: R$ 300k

**Custos**:

- Desenvolvimento: R$ 800k
- Vendas/Marketing: R$ 600k
- Compliance: R$ 300k
- Operações: R$ 300k
- **Total**: R$ 2M

**Runway**: 18-24 meses com seed de R$ 2M

### Projeções (3 anos)

**Ano 1**: 6 clientes, R$ 300k receita
**Ano 2**: 30 clientes, R$ 2.4M receita
**Ano 3**: 80 clientes, R$ 8M receita

**Break-even**: Mês 18-20

---

## Notas para Apresentação

### Tempo: 15-20 minutos + Q&A

### Slides Principais (Foco):

1. Problema (2 min)
2. Solução (3 min)
3. Como Funciona (2 min)
4. Mercado (2 min)
5. Modelo de Negócio (2 min)
6. ROI (2 min)
7. Tração (1 min)
8. Roadmap (1 min)
9. Fundraising (2 min)
10. Call to Action (1 min)

### Dicas:

- Usar dados e números concretos
- Mostrar demo do produto (se disponível)
- Focar em ROI e economia
- Destacar diferenciais (IA, WhatsApp)
- Ser transparente sobre riscos
