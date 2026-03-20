# Prova de Conceito (PoC) – OncoNav

Documento de escopo da Prova de Conceito para validação técnica e de valor da plataforma de navegação oncológica antes do MVP completo.

**Versão:** 1.0  
**Última atualização:** 2025-03

---

## 1. Objetivos da PoC

| Objetivo | O que validar |
|----------|----------------|
| **Técnico** | Integração WhatsApp + IA + backend funciona de ponta a ponta em ambiente controlado |
| **Valor** | Enfermagem/gestão enxergam benefício (priorização, alertas, menos ligações) em um fluxo real |
| **Adoção** | Pacientes respondem ao agente no WhatsApp e aceitam o canal (mesmo com amostra pequena) |
| **Demonstração** | Base para demo ao vivo (Centelha ES, hospitais piloto, investidores) |

**Pergunta central:** *“O núcleo da solução funciona e entrega valor em um fluxo mínimo?”*

---

## 2. Escopo – Dentro da PoC

### 2.1 Tenant e jornada

- [ ] **Um tenant** (ex.: “Hospital Piloto” ou HUCAM)
- [ ] **Um tipo de câncer / uma jornada** (ex.: colorretal – rastreio → diagnóstico → tratamento)
- [ ] Dados de demonstração: 10–15 pacientes fictícios com perfis variados

### 2.2 Agente WhatsApp

- [ ] **Um número** WhatsApp Business (Cloud API) conectado ao backend
- [ ] Agente que:
  - [ ] Recebe **texto** do paciente
  - [ ] (Opcional) Recebe **áudio** e transcreve (STT)
  - [ ] Faz perguntas simples (sintomas, adesão, dúvidas) de forma conversacional
  - [ ] Detecta **pelo menos um sintoma crítico** (ex.: dor intensa 8–10/10)
  - [ ] Dispara **um tipo de alerta** quando sintoma crítico é detectado
- [ ] Respostas com guardrails (não diagnóstico; orienta a procurar equipe em caso de emergência)
- [ ] **Fora do escopo da PoC:** questionários completos (EORTC, PRO-CTCAE, ESAS)

### 2.3 Priorização com IA

- [ ] **Score 0–100** por paciente com base em critérios limitados, por exemplo:
  - [ ] Sintoma crítico reportado (peso alto)
  - [ ] Dias sem interação
  - [ ] Estágio da doença (se disponível)
  - [ ] Etapa da navegação atrasada
- [ ] **Lista de pacientes** ordenada por score (maior prioridade primeiro)
- [ ] **Explicabilidade:** pelo menos uma linha explicando o motivo da prioridade (ex.: “Dor intensa reportada há 2h”, “Sem resposta há 5 dias”)

### 2.4 Dashboard enfermagem (mínimo)

- [ ] **Lista de pacientes** ordenada por prioridade (score visível)
- [ ] **Ao clicar em um paciente:** histórico completo da conversa WhatsApp
- [ ] **Um tipo de alerta em tempo real** (ex.: “Sintoma crítico detectado”) – WebSocket ou polling
- [ ] **Uma ação “Assumir conversa”** (handoff): enfermagem pode marcar que assumiu e, se implementado, responder manualmente (ou simulado)
- [ ] Indicadores visuais por prioridade (ex.: cor vermelha para crítico)

### 2.5 Backend e dados

- [ ] Autenticação (login) e isolamento por tenant
- [ ] CRUD básico de pacientes (nome, telefone, estágio/jornada)
- [ ] Armazenamento de mensagens WhatsApp e eventos (sintoma crítico, alerta)
- [ ] Cálculo de score e atualização na listagem
- [ ] **Fora do escopo:** integração FHIR/HL7 real (pode ser simulada com dados fixos)

---

## 3. Escopo – Fora da PoC

| Item | Motivo |
|------|--------|
| Integração HL7/FHIR real | Validar com dados mock; integração em fase MVP |
| Múltiplos tipos de câncer / várias jornadas | Um fluxo basta para provar o conceito |
| Questionários validados (EORTC, PRO-CTCAE, ESAS) | Coleta conversacional simples primeiro |
| Múltiplos tenants em produção | Um tenant de demonstração |
| Relatórios e analytics avançados | Apenas lista ordenada e alertas |
| App mobile para paciente | Apenas WhatsApp |
| Certificação ANVISA / ISO | Fase posterior ao piloto |

---

## 4. Critérios de sucesso

### 4.1 Técnicos

- [ ] Paciente envia mensagem no WhatsApp → agente responde em &lt; 30 s (p95)
- [ ] Mensagem com sintoma crítico (ex.: “estou com muita dor”) → alerta criado e exibido no dashboard
- [ ] Score de prioridade calculado e lista ordenada corretamente
- [ ] Enfermagem vê conversa completa e consegue “assumir” o caso
- [ ] Fluxo ponta a ponta estável em ambiente de demo (sem queda crítica em sessão de 30 min)

### 4.2 Valor / demonstração

- [ ] Demo ao vivo reproduzível em 15–20 min (ver `docs/demo/guia-demo-ao-vivo.md`)
- [ ] Pelo menos um caso de uso completo demonstrado: **sintoma crítico → alerta → priorização → intervenção**
- [ ] Feedback positivo de pelo menos 2 pessoas (equipe interna ou parceiro) sobre clareza do valor

### 4.3 Opcionais (se houver tempo)

- [ ] 3–5 usuários externos (enfermagem ou gestor) testam e respondem 3 perguntas de satisfação
- [ ] Um paciente real (ou ator) completa fluxo via WhatsApp e comenta usabilidade

---

## 5. Checklist técnico de implementação

### Infraestrutura e ambiente

- [ ] Ambiente de demo/staging disponível (frontend + backend + ai-service)
- [ ] PostgreSQL com schema e seed para 10–15 pacientes de demonstração
- [ ] Variáveis de ambiente configuradas (WhatsApp, LLM, JWT, etc.)
- [ ] HTTPS para webhook WhatsApp (ngrok ou similar em dev)

### WhatsApp

- [ ] Conta/número WhatsApp Business (Cloud API) configurado
- [ ] Webhook recebendo mensagens e repassando ao backend
- [ ] Backend encaminha para ai-service (agente) e persiste mensagens
- [ ] Resposta do agente enviada de volta ao paciente via API WhatsApp
- [ ] (Opcional) STT para áudio configurado e testado

### Agente de IA

- [ ] Prompt/system do agente definido (coleta de sintomas, tom empático, guardrails)
- [ ] Detecção de sintoma crítico (regex + LLM ou regras) e criação de evento/alerta
- [ ] Fallback quando LLM indisponível (resposta padrão ou mensagem de manutenção)
- [ ] Sem uso de `console.log` em produção; logs estruturados

### Priorização

- [ ] Endpoint ou job que calcula score (0–100) por paciente
- [ ] Critérios documentados (sintoma crítico, dias sem interação, estágio, atrasos)
- [ ] Explicabilidade: texto ou campos que justificam o score
- [ ] Lista do dashboard consumindo ordenação por score

### Dashboard

- [ ] Página principal com lista de pacientes ordenada por prioridade
- [ ] Detalhe do paciente com histórico de mensagens WhatsApp
- [ ] Exibição de alertas (em tempo real ou ao recarregar)
- [ ] Botão/ação “Assumir conversa” com estado persistido (quem assumiu, quando)
- [ ] Cores ou badges por faixa de prioridade (crítico/alto/médio/baixo)

### Segurança e boas práticas

- [ ] Autenticação JWT e tenantId em todas as queries
- [ ] Nenhum dado sensível em logs
- [ ] Webhook WhatsApp com validação de assinatura (se aplicável)

---

## 6. Prazo e fases sugeridas

| Fase | Duração sugerida | Entregas principais |
|------|------------------|----------------------|
| **Fase 1 – Fundação** | 1–2 semanas | Ambiente estável, WhatsApp conectado, agente responde texto |
| **Fase 2 – Priorização e alertas** | 1–2 semanas | Score, explicabilidade, alerta por sintoma crítico, lista ordenada |
| **Fase 3 – Dashboard e handoff** | 1–2 semanas | Lista, histórico de conversa, alertas na tela, “Assumir conversa” |
| **Fase 4 – Polimento e demo** | ~1 semana | Dados de demo, roteiro de demo, ensaio da apresentação |
| **Total** | **4–8 semanas** | PoC pronta para demonstração |

*(Ajustar conforme o que já existir no repositório.)*

---

## 7. Próximos passos após a PoC

1. **Demo** para Centelha ES, HUCAM/UFES ou primeiro investidor usando o guia em `docs/demo/guia-demo-ao-vivo.md`.
2. **Decisão:** seguir para MVP completo (ver `docs/mvp-scope/mvp-features.md`) ou iterar na PoC (ex.: mais um tipo de alerta, mais um critério de priorização).
3. **Piloto:** definir instituição e coorte (ex.: Oncologia Urológica) para validação com pacientes reais e métricas (tempo até diagnóstico, adesão, satisfação).
4. **Documentar** lições aprendidas (o que funcionou, o que atrasou, o que cortar ou adiar no MVP).

---

## 8. Referências no repositório

- **Visão e solução:** `docs/centelha-espirito-santo/solucao.md`
- **MVP e features:** `docs/mvp-scope/mvp-features.md`
- **Demo ao vivo:** `docs/demo/guia-demo-ao-vivo.md`
- **Arquitetura:** `CLAUDE.md` (raiz do projeto)
- **Navegação oncológica:** `docs/desenvolvimento/navegacao-oncologica-colorretal.md`

---

*Documento criado para alinhar escopo da Prova de Conceito e servir de referência para planejamento e execução.*
