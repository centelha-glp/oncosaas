# Painéis Redimensionáveis no Chat

**Data:** 2026-04-13  
**Componente:** `ResizablePanel`  
**Foco:** Permitir que usuários ajustem a largura das abas laterais e área de conversa

---

## 📊 Visão Geral

O chat agora possui painéis redimensionáveis que permitem aos usuários ajustar a largura das abas laterais (pacientes/alertas e detalhes) e da área de conversa conforme sua preferência.

---

## 🎯 Funcionalidades Implementadas

### ✅ Redimensionamento por Drag

- **Handle visual**: Ícone de grip (`GripVertical`) que aparece ao passar o mouse
- **Feedback visual**: Handle muda de cor quando está sendo arrastado
- **Cursor**: Muda para `col-resize` durante o redimensionamento
- **Limites**: Larguras mínima e máxima configuráveis

### ✅ Persistência de Preferências

- **localStorage**: Larguras são salvas automaticamente no navegador
- **Chaves únicas**: Cada painel tem sua própria chave (`chat-left-panel-width`, `chat-right-panel-width`)
- **Carregamento automático**: Preferências são restauradas ao recarregar a página

### ✅ Responsividade

- **Larguras mínimas**: Garantem que o conteúdo não fique muito comprimido
- **Larguras máximas**: Previnem que painéis ocupem toda a tela
- **Área central flexível**: A área de conversa se ajusta automaticamente ao espaço restante

---

## 🏗️ Estrutura do Componente

### `ResizablePanel`

**Localização:** `frontend/src/components/dashboard/resizable-panel.tsx`

**Props:**

```typescript
interface ResizablePanelProps {
  children: React.ReactNode;
  defaultWidth?: number; // Largura padrão em pixels (padrão: 300)
  minWidth?: number; // Largura mínima em pixels (padrão: 200)
  maxWidth?: number; // Largura máxima em pixels (padrão: 800)
  storageKey?: string; // Chave para localStorage (opcional)
  onResize?: (width: number) => void; // Callback quando redimensionar
  side?: 'left' | 'right'; // Lado do painel (padrão: 'left')
}
```

**Características:**

- Handle de redimensionamento posicionado no lado correto (`left` ou `right`)
- Estado interno para controlar largura e estado de redimensionamento
- Event listeners para `mousemove` e `mouseup` durante o drag
- Cleanup adequado de event listeners

---

## 📐 Configuração Atual no Chat

### Sidebar Esquerda (Pacientes e Alertas)

```typescript
<ResizablePanel
  defaultWidth={320}
  minWidth={250}
  maxWidth={500}
  storageKey="chat-left-panel-width"
  side="left"
>
  {/* Conteúdo */}
</ResizablePanel>
```

### Área Central (Conversa)

- **Flexível**: Usa `flex-1` para ocupar espaço restante
- **Min-width**: `min-w-0` para permitir compressão adequada

### Sidebar Direita (Detalhes)

```typescript
<ResizablePanel
  defaultWidth={360}
  minWidth={280}
  maxWidth={600}
  storageKey="chat-right-panel-width"
  side="right"
>
  {/* Conteúdo */}
</ResizablePanel>
```

---

## 🎨 Design e UX

### Handle de Redimensionamento

- **Posição**: Absoluta, no lado correto do painel
- **Largura**: 1px (visível ao hover)
- **Cor padrão**: Transparente
- **Cor hover**: `bg-indigo-500`
- **Cor ativa**: `bg-indigo-500` (quando arrastando)
- **Ícone**: `GripVertical` centralizado

### Feedback Visual

- **Cursor**: `col-resize` durante o redimensionamento
- **User-select**: Desabilitado durante o drag
- **Transição**: Suave ao mudar de estado

---

## 🔧 Implementação Técnica

### Estado

```typescript
const [width, setWidth] = useState(defaultWidth);
const [isResizing, setIsResizing] = useState(false);
const startXRef = useRef<number>(0);
const startWidthRef = useRef<number>(0);
```

### Fluxo de Redimensionamento

1. **Mouse Down**:
   - Salva posição inicial (`startXRef`)
   - Salva largura inicial (`startWidthRef`)
   - Ativa estado `isResizing`
   - Muda cursor para `col-resize`

2. **Mouse Move**:
   - Calcula delta X (diferença entre posição atual e inicial)
   - Ajusta delta conforme lado do painel (`left` ou `right`)
   - Calcula nova largura respeitando `minWidth` e `maxWidth`
   - Atualiza estado `width`

3. **Mouse Up**:
   - Desativa estado `isResizing`
   - Restaura cursor padrão
   - Remove event listeners

### Persistência

```typescript
// Salvar no localStorage
useEffect(() => {
  if (storageKey && typeof window !== 'undefined') {
    localStorage.setItem(storageKey, width.toString());
  }
  onResize?.(width);
}, [width, storageKey, onResize]);

// Carregar do localStorage
useEffect(() => {
  if (storageKey && typeof window !== 'undefined') {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const savedWidth = parseInt(saved, 10);
      if (savedWidth >= minWidth && savedWidth <= maxWidth) {
        setWidth(savedWidth);
      }
    }
  }
}, [storageKey, minWidth, maxWidth]);
```

---

## 📱 Responsividade

### Desktop (lg:)

- Layout flexível com painéis redimensionáveis
- Área central se ajusta automaticamente

### Mobile/Tablet

- **TODO**: Implementar layout responsivo para telas menores
- Possivelmente ocultar painéis laterais ou usar drawer

---

## 🐛 Troubleshooting

### Handle não aparece

- Verificar se `side` está correto (`left` ou `right`)
- Verificar se z-index está adequado (`z-10`)

### Redimensionamento não funciona

- Verificar se event listeners estão sendo adicionados/removidos corretamente
- Verificar se `isResizing` está sendo atualizado

### Largura não persiste

- Verificar se `storageKey` está definido
- Verificar se localStorage está disponível (`typeof window !== 'undefined'`)
- Verificar se valores estão dentro dos limites (`minWidth`, `maxWidth`)

---

## 🚀 Melhorias Futuras

### Curto Prazo

- [ ] Adicionar animação suave ao redimensionar
- [ ] Adicionar tooltip explicativo no handle
- [ ] Adicionar atalho de teclado para resetar larguras

### Médio Prazo

- [ ] Suporte para redimensionamento vertical (altura)
- [ ] Múltiplos breakpoints (salvar larguras diferentes por tamanho de tela)
- [ ] Sincronização entre dispositivos (usando backend)

### Longo Prazo

- [ ] Layouts personalizáveis (salvar layouts completos)
- [ ] Drag and drop para reorganizar painéis
- [ ] Modo de tela cheia para área de conversa

---

## 📚 Referências

- **React Hooks**: `useState`, `useEffect`, `useRef`, `useCallback`
- **Event Handling**: Mouse events (`mousedown`, `mousemove`, `mouseup`)
- **localStorage API**: Persistência de dados no navegador
- **Tailwind CSS**: Classes utilitárias para layout e estilo

---

**Última atualização:** 2026-04-13  
**Versão:** 1.0.0
