# Configuração HTTPS para Desenvolvimento Local

## Problema

O Facebook Embedded Signup **requer HTTPS** para funcionar. Em desenvolvimento local usando `http://localhost`, você receberá o erro:

> "O Facebook detectou que o [App] não está usando uma conexão segura para a transferência de informações."

## Solução: Certificados SSL Autoassinados

### 1. Gerar Certificados

Execute o script de geração de certificados:

```bash
npm run generate-certs
```

Este script tentará usar `mkcert` (recomendado) ou `OpenSSL` (fallback).

**Se usar mkcert:**

- O certificado será automaticamente instalado como confiável
- Funciona perfeitamente com navegadores

**Se usar OpenSSL:**

- Você precisará instalar o certificado manualmente no sistema operacional

### 2. Instalar Certificado (se usar OpenSSL)

#### Windows:

1. Clique duas vezes em `certs/localhost.crt`
2. Clique em "Instalar Certificado"
3. Selecione "Usuário Atual"
4. Selecione "Colocar todos os certificados no seguinte repositório"
5. Navegue até "Repositório de Autoridades de Certificação Raiz Confiáveis"
6. Clique em Concluir

**Ou via PowerShell (como Administrador):**

```powershell
Import-Certificate -FilePath ".\certs\localhost.crt" -CertStoreLocation Cert:\CurrentUser\Root
```

#### Mac:

1. Abra Keychain Access
2. Arraste `certs/localhost.crt` para "login"
3. Clique duas vezes no certificado
4. Expanda "Trust" e selecione "Always Trust"

#### Linux:

```bash
sudo cp certs/localhost.crt /usr/local/share/ca-certificates/localhost.crt
sudo update-ca-certificates
```

### 3. Executar Servidores com HTTPS

#### Opção 1: Usar script npm (recomendado)

```bash
npm run dev:https
```

Este comando inicia ambos os servidores (frontend e backend) com HTTPS.

#### Opção 2: Executar separadamente

**Frontend:**

```bash
cd frontend
npm run dev:https
```

**Backend:**

```bash
cd backend
npm run start:dev:https
```

### 4. Atualizar Variáveis de Ambiente

Atualize os arquivos de ambiente por serviço para usar HTTPS:

**`frontend/.env`:**

```env
NEXT_PUBLIC_API_URL=https://localhost:3002
NEXT_PUBLIC_WS_URL=wss://localhost:3002
```

**`backend/.env`:**

```env
FRONTEND_URL=https://localhost:3000
USE_HTTPS=true
```

### 5. Acessar a Aplicação

Após iniciar os servidores, acesse:

- **Frontend:** https://localhost:3000
- **Backend:** https://localhost:3002

⚠️ **Aviso de Segurança do Navegador:**

- O navegador mostrará um aviso sobre o certificado não confiável
- Clique em "Avançado" → "Continuar para localhost"
- Isso é normal para certificados autoassinados

### 6. Configurar Meta App para Aceitar HTTPS Local

No Meta App Dashboard:

1. Acesse: https://developers.facebook.com/apps/[SEU_APP_ID]/settings/basic/
2. Em "App Domains", adicione: `localhost`
3. Em "Website", adicione: `https://localhost:3000`
4. Em "Valid OAuth Redirect URIs", adicione:
   - `https://localhost:3000/dashboard/integrations`
   - `https://localhost:3002/api/v1/whatsapp-connections/oauth/callback`

### 7. Verificar Configuração

1. Certifique-se de que os certificados foram gerados:

   ```bash
   ls certs/
   # Deve mostrar: localhost.crt e localhost.key
   ```

2. Verifique se os servidores estão rodando em HTTPS:
   - Frontend: https://localhost:3000
   - Backend: https://localhost:3002/api/v1/health

3. Teste o Embedded Signup:
   - Acesse: https://localhost:3000/dashboard/integrations
   - Clique em "Conectar com Meta (Embedded Signup)"
   - O popup do Facebook deve abrir sem erros de HTTPS

## Troubleshooting

### Erro: "Certificados SSL não encontrados"

- Execute: `npm run generate-certs`
- Verifique se os arquivos existem em `certs/`

### Erro: "NET::ERR_CERT_AUTHORITY_INVALID"

- Instale o certificado no sistema operacional (veja passo 2)
- Se usar mkcert, execute: `mkcert -install`

### Erro: "ERR_SSL_PROTOCOL_ERROR"

- Verifique se os servidores estão rodando com HTTPS
- Verifique se as portas estão corretas (3000 para frontend, 3002 para backend)

### Erro: "CORS policy"

- Atualize `FRONTEND_URL` no backend para `https://localhost:3000`
- Verifique se o CORS está configurado corretamente no `main.ts`

### Facebook ainda mostra erro de HTTPS

- Verifique se está acessando via `https://` (não `http://`)
- Verifique se o certificado está instalado como confiável
- Limpe o cache do navegador
- Tente em modo anônimo/privado

## Alternativa: Usar ngrok

Se preferir não usar certificados autoassinados, você pode usar ngrok:

```bash
# Instalar ngrok
choco install ngrok  # Windows
brew install ngrok   # Mac

# Criar túnel HTTPS
ngrok http 3000

# Use a URL fornecida pelo ngrok (ex: https://abc123.ngrok.io)
```

Atualize as configurações do Meta App para usar a URL do ngrok.
