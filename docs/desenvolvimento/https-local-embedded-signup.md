# Configuração HTTPS para Embedded Signup em Desenvolvimento Local

## Problema

O Facebook Embedded Signup **requer HTTPS** para funcionar. Em desenvolvimento local usando `http://localhost`, você receberá o erro:

> "O Facebook detectou que o [App] não está usando uma conexão segura para a transferência de informações."

## Solução: Usar ngrok (Recomendado)

### 1. Instalar ngrok

**Windows (via Chocolatey):**

```bash
choco install ngrok
```

**Ou baixar manualmente:**

- Acesse: https://ngrok.com/download
- Baixe e extraia o executável
- Adicione ao PATH ou use o caminho completo

**Linux/Mac:**

```bash
# Via Homebrew (Mac)
brew install ngrok

# Ou baixar de https://ngrok.com/download
```

### 2. Criar conta no ngrok (gratuito)

1. Acesse: https://dashboard.ngrok.com/signup
2. Crie uma conta gratuita
3. Copie seu authtoken da dashboard

### 3. Configurar authtoken

```bash
ngrok config add-authtoken SEU_AUTHTOKEN_AQUI
```

### 4. Iniciar túnel HTTPS para o frontend

```bash
# Túnel para o frontend (porta 3000)
ngrok http 3000

# Ou para o backend (porta 3002) se necessário
ngrok http 3002
```

O ngrok fornecerá uma URL HTTPS como: `https://abc123.ngrok-free.app`

### 5. Configurar no App Dashboard do Facebook

1. Acesse: https://developers.facebook.com/apps/
2. Selecione seu app
3. Vá em **Facebook Login for Business** > **Settings** > **Client OAuth settings**
4. Adicione o domínio do ngrok em **Allowed domains**:
   - Exemplo: `abc123.ngrok-free.app` (sem `https://`)
5. Adicione a URL completa em **Valid OAuth redirect URIs**:
   - Exemplo: `https://abc123.ngrok-free.app/integrations`

### 6. Atualizar variáveis de ambiente

**Frontend (`frontend/.env`):**

```env
NEXT_PUBLIC_API_URL=https://abc123.ngrok-free.app:3002
# Ou se o backend também estiver no ngrok:
# NEXT_PUBLIC_API_URL=https://def456.ngrok-free.app
```

**Backend (`backend/.env`):**

```env
FRONTEND_URL=https://abc123.ngrok-free.app
# Para Embedded Signup: URL da página /integrations (deve ser idêntica à cadastrada no App Meta)
META_EMBEDDED_SIGNUP_REDIRECT_URI=https://abc123.ngrok-free.app/integrations
# Para fluxo OAuth manual (se usar):
# META_OAUTH_REDIRECT_URI=https://abc123.ngrok-free.app/api/v1/whatsapp-connections/oauth/callback
```

### 7. Reiniciar servidores

```bash
# Frontend
cd frontend
npm run dev

# Backend (em outro terminal)
cd backend
npm run start:dev
```

### 8. Acessar via URL do ngrok

Acesse: `https://abc123.ngrok-free.app/integrations`

## Alternativa: Cloudflare Tunnel

Se preferir usar Cloudflare Tunnel (também gratuito):

```bash
# Instalar cloudflared
# Windows: choco install cloudflared
# Mac: brew install cloudflared
# Linux: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/

# Criar túnel
cloudflared tunnel --url http://localhost:3000
```

## Nota Importante

- **URLs do ngrok mudam a cada reinício** (na versão gratuita)
- Para URLs estáticas, considere o plano pago do ngrok
- Em produção, use HTTPS real com certificado SSL válido

## Verificação

Após configurar:

1. Acesse a URL HTTPS do ngrok
2. Clique em "Conectar com Meta (Embedded Signup)"
3. O popup deve abrir sem erro de conexão insegura
