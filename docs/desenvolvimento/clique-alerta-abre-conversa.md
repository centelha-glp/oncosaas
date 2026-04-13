# Clique no Alerta Abre Conversa - Implementação

**Data:** 2026-04-13  
**Status:** ✅ Implementado  
**Prioridade:** 🔴 ALTA (UX e Produtividade)

---

## 📋 Resumo

Implementação da funcionalidade onde ao clicar no card de alerta, além de mostrar os detalhes do alerta na sidebar direita, também abre automaticamente a conversa com o paciente relacionado ao alerta.

---

## ✅ Funcionalidades Implementadas

### 1. **Seleção Automática do Paciente**

**Arquivo:** `frontend/src/app/chat/page.tsx`

- ✅ Ao clicar no card de alerta, seleciona o alerta (`setSelectedAlert`)
- ✅ Também seleciona o paciente relacionado (`setSelectedPatient`)
- ✅ Muda automaticamente para a aba "Pacientes" para mostrar a conversa
- ✅ Verifica se `alert.patientId` existe antes de selecionar

**Código:**

```typescript
onAlertSelect={(alert) => {
  // Selecionar o alerta para mostrar detalhes
  setSelectedAlert(alert);
  // Também selecionar o paciente para abrir a conversa
  if (alert.patientId) {
    setSelectedPatient(alert.patientId);
    // Mudar para aba de pacientes para mostrar a conversa
    setActiveTab('patients');
  }
}}
```

### 2. **Prevenção de Event Bubbling**

**Arquivo:** `frontend/src/components/dashboard/alerts-panel.tsx`

- ✅ Botões "Reconhecer" e "Resolver" usam `e.stopPropagation()`
- ✅ Evita que o clique no botão também selecione o alerta
- ✅ Permite ações específicas sem interferir na seleção

**Código:**

```typescript
onClick={(e) => {
  e.stopPropagation(); // Evitar que o clique no botão também selecione o alerta
  acknowledgeAlert.mutate(alert.id);
}}
```

---

## 🎯 Fluxo de Funcionamento

```
1. Usuário vê alerta na aba "Alertas"
   ↓
2. Usuário clica no card do alerta
   ↓
3. Sistema seleciona o alerta (mostra detalhes na sidebar direita)
   ↓
4. Sistema também seleciona o paciente relacionado (alert.patientId)
   ↓
5. Sistema muda para aba "Pacientes" automaticamente
   ↓
6. Conversa do paciente é aberta na área principal
   ↓
7. Detalhes do alerta continuam visíveis na sidebar direita
```

---

## 🎨 Comportamento da UI

### Antes:

- Clicar no alerta apenas mostrava detalhes na sidebar
- Usuário precisava procurar o paciente manualmente
- Fluxo desconectado entre alerta e conversa

### Depois:

- ✅ Clicar no alerta abre **automaticamente** a conversa
- ✅ Detalhes do alerta continuam visíveis na sidebar
- ✅ Fluxo integrado e intuitivo
- ✅ Produtividade aumentada (menos cliques)

### Casos Especiais:

**Alerta sem paciente:**

- Se `alert.patientId` não existir, apenas seleciona o alerta
- Não tenta abrir conversa inexistente

**Botões de ação:**

- Clicar em "Reconhecer" ou "Resolver" não seleciona o alerta
- Apenas executa a ação específica
- Evita seleção acidental

---

## 📁 Arquivos Modificados

### Frontend

**Modificado:**

- `frontend/src/app/chat/page.tsx`
  - Handler `onAlertSelect` agora também seleciona paciente
  - Muda automaticamente para aba "Pacientes"

- `frontend/src/components/dashboard/alerts-panel.tsx`
  - Botões usam `e.stopPropagation()` para evitar event bubbling

---

## 🧪 Como Testar

1. **Clicar no card de alerta:**
   - Ir para aba "Alertas"
   - Clicar em qualquer card de alerta
   - Verificar que:
     - Aba muda para "Pacientes" automaticamente
     - Conversa do paciente é aberta
     - Detalhes do alerta aparecem na sidebar direita

2. **Clicar nos botões de ação:**
   - Clicar em "Reconhecer" ou "Resolver"
   - Verificar que:
     - Ação é executada (alerta reconhecido/resolvido)
     - Alerta não é selecionado (não abre conversa)
     - Lista de alertas atualiza

3. **Alerta sem paciente:**
   - Criar alerta sem `patientId` (se possível)
   - Clicar no alerta
   - Verificar que apenas detalhes são mostrados (sem erro)

---

## 🔄 Próximos Passos Relacionados

- [ ] **Highlight do paciente** - Destacar paciente na lista quando selecionado via alerta
- [ ] **Scroll automático** - Rolar até o paciente na lista quando selecionado
- [ ] **Badge de alerta** - Mostrar badge no card do paciente quando tem alerta pendente
- [ ] **Filtro por alerta** - Filtrar pacientes que têm alertas pendentes

---

## 📝 Notas Técnicas

### Event Handling

- **`e.stopPropagation()`:** Previne que eventos de filhos propaguem para pais
- Necessário nos botões para evitar seleção acidental do alerta
- Mantém comportamento esperado pelo usuário

### Estado Compartilhado

- `selectedAlert` e `selectedPatient` são estados separados
- Podem ser selecionados independentemente
- Funcionalidade permite seleção simultânea para melhor UX

### Navegação Automática

- Mudança de aba (`setActiveTab('patients')`) é automática
- Melhora fluxo de trabalho (menos cliques)
- Usuário pode voltar para "Alertas" se necessário

---

## ✅ Checklist de Implementação

- [x] Handler `onAlertSelect` seleciona paciente
- [x] Verificação de `patientId` antes de selecionar
- [x] Mudança automática para aba "Pacientes"
- [x] `stopPropagation` nos botões de ação
- [x] Detalhes do alerta continuam visíveis
- [x] Conversa do paciente abre automaticamente
- [x] Testes manuais realizados

---

**Última atualização:** 2026-04-13
