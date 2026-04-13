# Sidebar Direita - Detalhes do Paciente e Alerta

**Data:** 2026-04-13  
**Status:** ✅ Implementado  
**Componentes:** `PatientDetails`, `AlertDetails`

---

## 📋 Resumo Executivo

Implementação de uma sidebar direita no dashboard que exibe detalhes completos do paciente selecionado e do alerta selecionado, proporcionando acesso rápido a informações clínicas e contexto dos alertas sem precisar navegar para outras páginas.

---

## ✅ Funcionalidades Implementadas

### 1. **Componente PatientDetails**

**Localização:** `frontend/src/components/dashboard/patient-details.tsx`

**Funcionalidades:**

- ✅ Exibe informações básicas do paciente (nome, CPF, telefone, email, data de nascimento)
- ✅ Informações clínicas (tipo de câncer, estágio, data do diagnóstico, especialidade atual)
- ✅ Score de priorização (score numérico e categoria visual com cores)
- ✅ Razão da priorização (se disponível)
- ✅ Estados de loading e empty state
- ✅ Formatação de datas em português brasileiro
- ✅ Cálculo automático de idade

**Campos Exibidos:**

- Nome completo
- CPF (se disponível)
- Telefone
- Email (se disponível)
- Data de nascimento e idade calculada
- Tipo de câncer
- Estágio
- Data do diagnóstico
- Especialidade atual
- Score de prioridade (0-100)
- Categoria de prioridade (CRITICAL, HIGH, MEDIUM, LOW)
- Razão da priorização

---

### 2. **Componente AlertDetails**

**Localização:** `frontend/src/components/dashboard/alert-details.tsx`

**Funcionalidades:**

- ✅ Exibe status do alerta (PENDING, ACKNOWLEDGED, RESOLVED, DISMISSED)
- ✅ Severidade visual com cores (CRITICAL, HIGH, MEDIUM, LOW)
- ✅ Informações do paciente relacionado
- ✅ Tipo de alerta traduzido para português
- ✅ Mensagem completa do alerta
- ✅ Contexto (metadados JSON formatados)
- ✅ Timestamps (criação, reconhecimento, resolução)
- ✅ Ações rápidas (Reconhecer, Resolver) se pendente
- ✅ Botão de fechar para deselecionar alerta
- ✅ Estados de loading e empty state

**Campos Exibidos:**

- Status (com ícone visual)
- Severidade (badge colorido)
- Paciente (nome, telefone, score)
- Tipo de alerta (traduzido)
- Mensagem
- Contexto (JSON formatado)
- Timestamps formatados
- Ações (se aplicável)

---

### 3. **Integração no Chat**

**Modificações em `frontend/src/app/chat/page.tsx`:**

- ✅ Layout ajustado para grid de 12 colunas:
  - Sidebar esquerda: 2 colunas (pacientes e alertas)
  - Área central: 7 colunas (conversa)
  - Sidebar direita: 3 colunas (detalhes)
- ✅ Estado `selectedAlert` para controlar alerta selecionado
- ✅ Hook `useAlert` para buscar detalhes completos do alerta
- ✅ `AlertsPanel` atualizado para permitir seleção de alertas
- ✅ Feedback visual quando alerta está selecionado (ring indigo)

**Layout:**

```
┌─────────────┬──────────────────────────────┬─────────────┐
│             │                              │             │
│  Pacientes  │      Conversa WhatsApp       │  Detalhes   │
│             │                              │  Paciente   │
│             │                              │             │
│  Alertas    │                              │  Detalhes   │
│             │                              │  Alerta     │
│             │                              │             │
└─────────────┴──────────────────────────────┴─────────────┘
   2 cols          7 cols                       3 cols
```

---

## 🎨 Design e UX

### PatientDetails

- **Cores de Prioridade:**
  - CRITICAL: Vermelho (`text-red-600 bg-red-50`)
  - HIGH: Laranja (`text-orange-600 bg-orange-50`)
  - MEDIUM: Amarelo (`text-yellow-600 bg-yellow-50`)
  - LOW: Verde (`text-green-600 bg-green-50`)

- **Ícones:** User, Phone, Calendar, FileText, Activity, AlertCircle
- **Seções:** Informações básicas, clínicas, priorização, observações

### AlertDetails

- **Cores de Severidade:**
  - CRITICAL: Vermelho
  - HIGH: Laranja
  - MEDIUM: Amarelo
  - LOW: Verde

- **Ícones:** AlertTriangle, Clock, User, FileText, CheckCircle, XCircle
- **Seções:** Status, paciente, tipo/mensagem, contexto, timestamps, ações

---

## 🔄 Fluxo de Interação

1. **Selecionar Paciente:**
   - Usuário clica em um paciente na lista esquerda
   - `PatientDetails` exibe informações completas automaticamente
   - Conversa do paciente é carregada na área central

2. **Selecionar Alerta:**
   - Usuário clica em um alerta na lista esquerda
   - Alerta recebe destaque visual (ring indigo)
   - `AlertDetails` busca detalhes completos via API
   - Exibe informações detalhadas na sidebar direita

3. **Ações no Alerta:**
   - Se alerta está PENDING, botões "Reconhecer" e "Resolver" aparecem
   - Ao clicar, ação é executada e alerta é atualizado em tempo real
   - Status muda e timestamps são atualizados

4. **Fechar Alerta:**
   - Botão "✕" no canto superior direito
   - Remove seleção e limpa detalhes

---

## 📡 Integração com Backend

### Endpoints Utilizados:

- `GET /api/v1/patients/:id` - Buscar detalhes do paciente
- `GET /api/v1/alerts/:id` - Buscar detalhes do alerta
- `PATCH /api/v1/alerts/:id/acknowledge` - Reconhecer alerta
- `PATCH /api/v1/alerts/:id/resolve` - Resolver alerta

### Hooks React Query:

- `usePatient(id)` - Busca dados do paciente
- `useAlert(id)` - Busca dados completos do alerta
- `useAcknowledgeAlert()` - Mutação para reconhecer
- `useResolveAlert()` - Mutação para resolver

---

## 🎯 Benefícios

1. **Acesso Rápido:** Informações completas sem navegação adicional
2. **Contexto Completo:** Detalhes do paciente e alerta visíveis simultaneamente
3. **Ações Rápidas:** Reconhecer/resolver alertas diretamente da sidebar
4. **Visualização Clara:** Formatação adequada de dados clínicos
5. **Responsivo:** Layout adaptável para diferentes tamanhos de tela

---

## 🔮 Melhorias Futuras

- [ ] Adicionar gráfico de histórico de scores de prioridade
- [ ] Exibir últimas observações clínicas do paciente
- [ ] Mostrar histórico de alertas do paciente
- [ ] Adicionar botão para editar informações do paciente
- [ ] Exibir próximas consultas/tratamentos agendados
- [ ] Adicionar notas rápidas do enfermeiro sobre o paciente
- [ ] Integrar com calendário de tratamento

---

## 📝 Notas Técnicas

- **Performance:** Componentes usam React Query para cache e invalidação inteligente
- **Type Safety:** Todos os componentes são tipados com TypeScript
- **Acessibilidade:** Ícones descritivos e labels claros
- **Loading States:** Skeletons animados durante carregamento
- **Empty States:** Mensagens claras quando não há dados

---

## ✅ Checklist de Implementação

- [x] Criar componente `PatientDetails`
- [x] Criar componente `AlertDetails`
- [x] Atualizar `AlertsPanel` para permitir seleção
- [x] Integrar componentes no dashboard
- [x] Ajustar layout do grid
- [x] Adicionar estado para alerta selecionado
- [x] Implementar busca de detalhes do alerta
- [x] Adicionar ações rápidas (reconhecer/resolver)
- [x] Testar estados de loading e empty
- [x] Verificar responsividade

---

**Última atualização:** 2026-04-13
