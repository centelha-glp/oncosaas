# Detecção Automática de HTTP/HTTPS

## Visão Geral

O app agora detecta automaticamente se está rodando em HTTP ou HTTPS, permitindo que funcione com ambos os protocolos sem necessidade de alterar variáveis de ambiente manualmente.

## Como Funciona

### Frontend

O frontend detecta o protocolo baseado na URL atual da página:

1. **No cliente (browser)**: Usa `window.location.protocol` para detectar se a página está em `http://` ou `https://`
2. **No servidor (SSR)**: Usa a variável de ambiente `NEXT_PUBLIC_API_URL` se definida, senão assume HTTP

A detecção é feita pelo utilitário `frontend/src/lib/utils/api-config.ts`:

- `getApiUrl()`: Retorna a URL da API (http://localhost:3002 ou https://localhost:3002)
- `getWebSocketUrl()`: Retorna a URL do WebSocket (ws://localhost:3002 ou wss://localhost:3002)

### Backend

O backend continua usando a variável `USE_HTTPS` para determinar se deve iniciar com HTTPS:

- `USE_HTTPS=true`: Inicia com HTTPS (requer certificados em `certs/`)
- `USE_HTTPS=false` ou não definido: Inicia com HTTP (padrão)

O CORS foi configurado para aceitar ambos os protocolos em desenvolvimento, permitindo flexibilidade.

## Uso

### Modo HTTP (Padrão)

```bash
# Iniciar todos os serviços em HTTP
npm run dev

# Ou iniciar apenas o backend
npm run backend:dev
```

O frontend detectará automaticamente que está em `http://localhost:3000` e usará `http://localhost:3002` para a API.

### Modo HTTPS

```bash
# Iniciar todos os serviços em HTTPS
npm run dev:https

# Ou iniciar apenas o backend em HTTPS
npm run backend:dev:https
```

O frontend detectará automaticamente que está em `https://localhost:3000` e usará `https://localhost:3002` para a API.

### Forçar URL Específica

Se você precisar forçar uma URL específica (por exemplo, para desenvolvimento com proxy ou ambiente diferente), defina no `frontend/.env`:

```env
# Forçar HTTPS mesmo que a página esteja em HTTP
NEXT_PUBLIC_API_URL=https://localhost:3002
NEXT_PUBLIC_WS_URL=wss://localhost:3002
```

Ou para forçar HTTP:

```env
# Forçar HTTP mesmo que a página esteja em HTTPS
NEXT_PUBLIC_API_URL=http://localhost:3002
NEXT_PUBLIC_WS_URL=ws://localhost:3002
```

## Arquivos Modificados

### Frontend

- `frontend/src/lib/utils/api-config.ts` (NOVO): Utilitário de detecção de protocolo
- `frontend/src/lib/api/client.ts`: Usa `getApiUrl()` em vez de variável estática
- `frontend/src/hooks/useSocket.ts`: Usa `getWebSocketUrl()` em vez de variável estática
- `frontend/next.config.js`: Removidas URLs hardcoded, agora usa detecção automática
- `frontend/.env`: URLs comentadas (opcionais)

### Backend

- `backend/src/main.ts`: CORS atualizado para aceitar ambos os protocolos em desenvolvimento
- `backend/.env`: `USE_HTTPS=false` como padrão (pode ser alterado para `true`)

## Vantagens

1. **Flexibilidade**: Funciona automaticamente com HTTP e HTTPS sem alterar código
2. **Simplicidade**: Não precisa alterar variáveis de ambiente ao alternar entre protocolos
3. **Compatibilidade**: Mantém suporte para forçar URLs específicas via variáveis de ambiente
4. **Desenvolvimento**: Facilita desenvolvimento local sem necessidade de certificados SSL

## Limitações

- A detecção funciona apenas para `localhost` (não para IPs ou domínios diferentes)
- Em produção, recomenda-se definir URLs explícitas via variáveis de ambiente
- O backend ainda precisa de `USE_HTTPS=true` para iniciar com HTTPS

## Troubleshooting

### Frontend não conecta ao backend

1. Verifique se o backend está rodando na porta correta (3002)
2. Verifique se o protocolo do frontend corresponde ao do backend:
   - Se frontend em `https://`, backend deve ter `USE_HTTPS=true`
   - Se frontend em `http://`, backend deve ter `USE_HTTPS=false` ou não definido

### Erro de CORS

O backend aceita ambos os protocolos em desenvolvimento. Se ainda houver erro:

1. Verifique se `FRONTEND_URL` no backend está correto
2. Verifique se o frontend está acessando a URL correta (http://localhost:3000 ou https://localhost:3000)

### WebSocket não conecta

1. Verifique se o protocolo do WebSocket corresponde ao do backend:
   - `ws://` para HTTP
   - `wss://` para HTTPS
2. Verifique se o Socket.io está configurado corretamente no backend
