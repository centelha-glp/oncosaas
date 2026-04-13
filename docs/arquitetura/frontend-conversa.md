# Arquitetura da Conversa no Frontend

**Data:** 2026-04-13  
**Componente:** `ConversationView` e integração com backend  
**Foco:** Fluxo de mensagens, handoff manual, atualizações em tempo real

---

## 📊 Visão Geral da Arquitetura

A conversa no frontend é o componente central que permite à equipe de enfermagem visualizar e interagir com pacientes via WhatsApp. O sistema funciona em **dois modos**:

1. **Modo Automático (Agente IA)**: Agente conversacional processa mensagens automaticamente
2. **Modo Manual (Enfermagem)**: Enfermeiro assume a conversa e responde diretamente

---

## 🏗️ Estrutura de Componentes

### Hierarquia de Componentes

```
ChatPage (chat/page.tsx)
  ├── PatientListConnected (lista de pacientes)
  ├── AlertsPanel (alertas pendentes)
  └── ConversationView (visualização da conversa)
      ├── Header (informações do paciente)
      ├── MessagesArea (área de mensagens)
      ├── StructuredDataPanel (dados estruturados extraídos)
      └── InputArea (campo de mensagem + botões)
```

### Componente Principal: `ConversationView`

**Localização:** `frontend/src/components/dashboard/conversation-view.tsx`

**Props:**

```typescript
interface ConversationViewProps {
  patientName: string; // Nome do paciente
  patientInfo: {
    // Informações clínicas
    cancerType: string;
    stage: string;
    age: number;
    priorityScore: number;
    priorityCategory: 'critico' | 'alto' | 'medio' | 'baixo';
  };
  messages: Message[]; // Array de mensagens da conversa
  structuredData?: {
    // Dados extraídos pelo agente IA
    symptoms: Record<string, number>; // Sintomas e intensidade (0-10)
    scales?: Record<string, number>; // Escalas (ex: EORTC QLQ-C30)
  };
  onSendMessage: (message: string) => void; // Callback para enviar mensagem
  onTakeOver: () => void; // Callback para assumir conversa
  isNursingActive: boolean; // Estado: enfermagem assumiu?
}
```

---

## 🔄 Fluxo de Dados Completo

### 1. **Carregamento Inicial da Conversa**

```
ChatPage monta
    ↓
usePatient(patientId) → Busca dados do paciente
    ↓
useMessages(patientId) → Busca mensagens da conversa
    ↓
ConversationView recebe props
    ↓
Renderiza mensagens ordenadas por timestamp
```

**Implementação atual:**

```typescript
// chat/page.tsx
const { data: selectedPatientData } = usePatient(selectedPatient || '', {
  enabled: !!selectedPatient,
});
const { data: messages } = useMessages(selectedPatient || undefined);

// Transformação de dados
messages={messages?.map((msg) => ({
  id: msg.id,
  sender: msg.direction === 'INBOUND' ? 'patient' : 'agent',
  content: msg.content,
  timestamp: new Date(msg.whatsappTimestamp || msg.createdAt),
})) || []}
```

---

### 2. **Fluxo de "Assumir Conversa"**

**Estado Inicial:**

- `isNursingActive = false`
- Botão "Assumir Conversa" visível
- Campo de mensagem desabilitado
- Agente IA continua processando mensagens

**Quando enfermeiro clica "Assumir Conversa":**

```
Enfermeiro clica "Assumir Conversa"
    ↓
onTakeOver() é chamado
    ↓
[FRONTEND] Atualiza estado local: isNursingActive = true
    ↓
[BACKEND] POST /api/v1/messages/:messageId/assume
    Body: { userId: currentUser.id }
    ↓
MessagesService.assumeConversation()
    ↓
Prisma: Atualiza Message
  - assumedBy = userId
  - assumedAt = now()
  - processedBy = 'NURSING'
    ↓
WebSocket: Emite evento 'message_assumed'
    ↓
[FRONTEND] Recebe evento via WebSocket
    ↓
Atualiza UI:
  - Esconde botão "Assumir Conversa"
  - Habilita campo de mensagem
  - Mostra badge "Assumido por: [Nome]"
```

**Implementação necessária:**

```typescript
// hooks/useMessages.ts
export const useAssumeConversation = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (messageId: string) => {
      return messagesApi.assume(messageId, user?.id || '');
    },
    onSuccess: () => {
      // Invalidar queries para atualizar UI
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
};

// chat/page.tsx
const assumeConversation = useAssumeConversation();

const handleTakeOver = async () => {
  if (!selectedPatient) return;

  // Encontrar última mensagem não assumida
  const lastMessage = messages?.find(
    (msg) => !msg.assumedBy && msg.direction === 'INBOUND'
  );

  if (lastMessage) {
    await assumeConversation.mutateAsync(lastMessage.id);
    setIsNursingActive(true);
  }
};
```

---

### 3. **Fluxo de Envio de Mensagem (Enfermagem)**

**Quando enfermeiro envia mensagem:**

```
Enfermeiro digita mensagem e clica "Enviar"
    ↓
onSendMessage(message) é chamado
    ↓
[FRONTEND] Validação (mensagem não vazia, isNursingActive = true)
    ↓
[BACKEND] POST /api/v1/messages
    Body: {
      patientId: string
      content: string
      direction: 'OUTBOUND'
      type: 'TEXT'
      processedBy: 'NURSING'
      assumedBy: userId
    }
    ↓
MessagesService.create()
    ↓
Prisma: Cria Message
    ↓
WhatsApp API: Envia mensagem para paciente
    ↓
WebSocket: Emite evento 'new_message'
    ↓
[FRONTEND] Recebe evento via WebSocket
    ↓
Atualiza lista de mensagens (otimistic update)
    ↓
Scroll automático para última mensagem
```

**Implementação necessária:**

```typescript
// hooks/useMessages.ts
export const useSendMessage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async ({
      patientId,
      content,
    }: {
      patientId: string;
      content: string;
    }) => {
      return messagesApi.send({
        patientId,
        content,
        direction: 'OUTBOUND',
        type: 'TEXT',
        processedBy: 'NURSING',
        assumedBy: user?.id,
      });
    },
    onMutate: async (variables) => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({
        queryKey: ['messages', variables.patientId],
      });

      // Snapshot do estado anterior
      const previousMessages = queryClient.getQueryData([
        'messages',
        variables.patientId,
      ]);

      // Optimistic update
      queryClient.setQueryData(
        ['messages', variables.patientId],
        (old: Message[]) => [
          ...(old || []),
          {
            id: 'temp-' + Date.now(),
            content: variables.content,
            direction: 'OUTBOUND',
            sender: 'nursing',
            timestamp: new Date(),
            isOptimistic: true,
          },
        ]
      );

      return { previousMessages };
    },
    onError: (err, variables, context) => {
      // Reverter em caso de erro
      queryClient.setQueryData(
        ['messages', variables.patientId],
        context?.previousMessages
      );
    },
    onSuccess: () => {
      // Invalidar para buscar dados atualizados
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
};

// chat/page.tsx
const sendMessage = useSendMessage();

const handleSendMessage = async (message: string) => {
  if (!selectedPatient || !isNursingActive) return;

  await sendMessage.mutateAsync({
    patientId: selectedPatient,
    content: message,
  });
};
```

---

### 4. **Atualizações em Tempo Real (WebSocket)**

**Eventos WebSocket que afetam a conversa:**

```typescript
// hooks/useMessagesSocket.ts
export const useMessagesSocket = (patientId?: string) => {
  const { socket, isConnected } = useSocket('/messages');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket || !isConnected || !patientId) return;

    // Entrar na room do paciente
    socket.emit('join_patient_room', { patientId });

    // Escutar novos eventos
    socket.on('new_message', (message: Message) => {
      // Atualizar cache do React Query
      queryClient.setQueryData(['messages', patientId], (old: Message[]) => {
        if (!old) return [message];
        // Evitar duplicatas
        if (old.some((m) => m.id === message.id)) return old;
        return [...old, message].sort(
          (a, b) =>
            new Date(a.whatsappTimestamp).getTime() -
            new Date(b.whatsappTimestamp).getTime()
        );
      });
    });

    socket.on(
      'message_assumed',
      (data: { messageId: string; userId: string }) => {
        // Atualizar mensagem específica
        queryClient.setQueryData(['messages', patientId], (old: Message[]) =>
          old?.map((msg) =>
            msg.id === data.messageId
              ? { ...msg, assumedBy: data.userId, assumedAt: new Date() }
              : msg
          )
        );
      }
    );

    return () => {
      socket.off('new_message');
      socket.off('message_assumed');
      socket.emit('leave_patient_room', { patientId });
    };
  }, [socket, isConnected, patientId, queryClient]);
};
```

---

## 🎨 Estados e Transições

### Estados da Conversa

```typescript
enum ConversationState {
  AUTO = 'auto', // Agente IA processando
  ASSUMED = 'assumed', // Enfermagem assumiu
  RESOLVED = 'resolved', // Caso resolvido
  CLOSED = 'closed', // Conversa fechada
}
```

### Transições de Estado

```
[AUTO] ──(enfermeiro clica "Assumir")──> [ASSUMED]
  │                                           │
  │                                           │ (enfermeiro resolve)
  │                                           ↓
  └──────────────────────────────────────> [RESOLVED]
                                              │
                                              │ (fechar caso)
                                              ↓
                                          [CLOSED]
```

---

## 📱 Interface do Usuário

### Layout do `ConversationView`

```
┌─────────────────────────────────────────┐
│ Header                                  │
│ Conversa: [Nome do Paciente]           │
│ [Tipo] - [Estágio] | Idade | Score     │
├─────────────────────────────────────────┤
│                                         │
│ MessagesArea (scrollável)               │
│ ┌─────────────┐  ┌─────────────┐      │
│ │ Paciente    │  │ Agente      │      │
│ │ Mensagem... │  │ Resposta... │      │
│ └─────────────┘  └─────────────┘      │
│                                         │
├─────────────────────────────────────────┤
│ StructuredDataPanel (se houver dados)  │
│ Sintomas: Dor 8/10, Náusea 5/10       │
├─────────────────────────────────────────┤
│ InputArea                                │
│ [Assumir Conversa] (se não assumido)   │
│ [Input] [Enviar] (se assumido)          │
└─────────────────────────────────────────┘
```

### Estados Visuais

**Estado 1: Não Assumido (`isNursingActive = false`)**

- Botão "Assumir Conversa" grande e visível
- Campo de mensagem desabilitado com placeholder: "Ative a conversa para enviar mensagens"
- Botão "Enviar" desabilitado
- Mensagens aparecem como "🤖 Agente" ou "👤 Paciente"

**Estado 2: Assumido (`isNursingActive = true`)**

- Botão "Assumir Conversa" desaparece
- Badge "Assumido por: [Nome do Enfermeiro]" aparece no header
- Campo de mensagem habilitado
- Botão "Enviar" habilitado
- Mensagens da enfermagem aparecem como "👩‍⚕️ Enfermagem"

---

## 🔌 Integração com Backend

### Endpoints Utilizados

**1. Buscar Mensagens da Conversa**

```typescript
GET /api/v1/messages?patientId={patientId}
Response: Message[]
```

**2. Assumir Conversa**

```typescript
POST /api/v1/messages/:messageId/assume
Body: { userId: string }
Response: Message (atualizada)
```

**3. Enviar Mensagem**

```typescript
POST /api/v1/messages
Body: {
  patientId: string
  content: string
  direction: 'OUTBOUND'
  type: 'TEXT'
  processedBy: 'NURSING'
  assumedBy?: string
}
Response: Message (criada)
```

**4. WebSocket Events**

```typescript
// Cliente emite
socket.emit('join_patient_room', { patientId })
socket.emit('leave_patient_room', { patientId })

// Servidor emite
socket.on('new_message', (message: Message))
socket.on('message_assumed', ({ messageId, userId }))
socket.on('alert_created', (alert: Alert))
```

---

## 🎯 Funcionalidades Implementadas vs Necessárias

### ✅ **Implementado**

1. **Visualização de mensagens**
   - Lista de mensagens ordenadas por timestamp
   - Diferenciação visual entre paciente/agente/enfermagem
   - Formatação de data/hora

2. **Estrutura básica do componente**
   - Header com informações do paciente
   - Área de mensagens scrollável
   - Campo de input (desabilitado quando não assumido)

3. **Integração com API**
   - `useMessages` hook para buscar mensagens
   - Transformação de dados do backend para formato do componente

### ❌ **Ainda Não Implementado**

1. **Assumir Conversa**
   - ❌ Hook `useAssumeConversation`
   - ❌ Endpoint `/assume` no frontend
   - ❌ Atualização de estado `isNursingActive`
   - ❌ Badge "Assumido por"

2. **Enviar Mensagem**
   - ❌ Hook `useSendMessage`
   - ❌ Endpoint de envio no frontend
   - ❌ Optimistic updates
   - ❌ Integração com WhatsApp API

3. **WebSocket em Tempo Real**
   - ❌ Hook `useMessagesSocket`
   - ❌ Escutar eventos `new_message`
   - ❌ Escutar eventos `message_assumed`
   - ❌ Atualização automática da lista

4. **Dados Estruturados**
   - ❌ Visualização de sintomas extraídos
   - ❌ Visualização de escalas (EORTC, etc.)
   - ❌ Gráficos de evolução

5. **Melhorias de UX**
   - ❌ Scroll automático para última mensagem
   - ❌ Indicador de digitação ("enfermeiro está digitando...")
   - ❌ Status de entrega (enviado, entregue, lido)
   - ❌ Suporte a áudio (playback)
   - ❌ Suporte a imagens

---

## 🚀 Próximos Passos de Implementação

### Fase 1: Funcionalidades Críticas (Sprint 1)

1. **Implementar `useAssumeConversation`**

   ```typescript
   // hooks/useMessages.ts
   export const useAssumeConversation = () => {
     // Ver implementação acima
   };
   ```

2. **Implementar `useSendMessage`**

   ```typescript
   // hooks/useMessages.ts
   export const useSendMessage = () => {
     // Ver implementação acima
   };
   ```

3. **Conectar callbacks no Chat**

   ```typescript
   // chat/page.tsx
   const assumeConversation = useAssumeConversation();
   const sendMessage = useSendMessage();

   const handleTakeOver = async () => {
     // Implementar lógica
   };

   const handleSendMessage = async (message: string) => {
     // Implementar lógica
   };
   ```

### Fase 2: Tempo Real (Sprint 2)

4. **Implementar `useMessagesSocket`**

   ```typescript
   // hooks/useMessagesSocket.ts
   export const useMessagesSocket = (patientId?: string) => {
     // Ver implementação acima
   };
   ```

5. **Integrar WebSocket no Chat**
   ```typescript
   // chat/page.tsx
   useMessagesSocket(selectedPatient || undefined);
   ```

### Fase 3: Melhorias de UX (Sprint 3)

6. **Scroll automático**
7. **Indicadores de status**
8. **Suporte a mídia (áudio, imagem)**

---

## 📋 Checklist de Implementação

- [ ] Criar hook `useAssumeConversation`
- [ ] Criar hook `useSendMessage`
- [ ] Criar hook `useMessagesSocket`
- [ ] Adicionar endpoint `assume` no `messagesApi`
- [ ] Adicionar endpoint `send` no `messagesApi`
- [ ] Conectar callbacks no `ChatPage`
- [ ] Adicionar badge "Assumido por" no header
- [ ] Implementar optimistic updates
- [ ] Testar fluxo completo de assumir + enviar
- [ ] Testar atualizações em tempo real via WebSocket
- [ ] Adicionar tratamento de erros
- [ ] Adicionar loading states
- [ ] Adicionar feedback visual (toast notifications)

---

## 🔒 Considerações de Segurança

1. **Validação de Permissões**
   - Apenas enfermeiros podem assumir conversas
   - Verificar role do usuário antes de permitir ações

2. **Auditoria**
   - Registrar todas as ações (assumir, enviar mensagem)
   - Logs de quem assumiu qual conversa e quando

3. **LGPD**
   - Mensagens criptografadas em repouso
   - Dados sensíveis mascarados no frontend (se necessário)
   - Consentimento do paciente para comunicação

---

## 📝 Notas de Design

### Por que dois modos (Automático vs Manual)?

1. **Eficiência**: Agente IA resolve 80% dos casos automaticamente
2. **Escalabilidade**: Enfermagem não precisa responder tudo manualmente
3. **Segurança**: Handoff manual para casos críticos/complexos
4. **Compliance**: Enfermagem sempre pode intervir quando necessário

### Por que "Assumir Conversa" e não "Responder"?

- **Assumir** implica transferência de controle
- Após assumir, agente IA para de processar mensagens desse paciente
- Enfermagem tem controle total da conversa
- Pode retornar para agente automático depois

---

**Próxima Revisão:** Após implementação das funcionalidades críticas (Fase 1)
