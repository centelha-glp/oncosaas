# ONCONAV - Plataforma de Navegação Oncológica

SaaS multi-tenant para navegação oncológica com agente de IA conversacional no WhatsApp, priorização inteligente de casos, sistema de alertas e dashboard para equipe de enfermagem.

[![GitHub](https://img.shields.io/badge/GitHub-ONCONAV-blue)](https://github.com/luizfiorimr/OncoNav)

## 🚀 Status do Projeto

- ✅ Estrutura inicial do projeto criada
- ✅ Stack tecnológico definido (Next.js, NestJS, FastAPI)
- ✅ Documentação completa criada
- ✅ Setup de desenvolvimento configurado
- ✅ **Sistema de Navegação Oncológica** implementado (câncer colorretal)
- ✅ **Sistema de Alertas** automáticos para atrasos e etapas pendentes
- ✅ **Dashboard para Enfermagem** com visualização de pacientes e priorização
- ✅ **Agente de IA WhatsApp** estruturado para conversação com pacientes
- ✅ **Modelos de Priorização** (XGBoost) para classificação de urgência
- ✅ **Integração FHIR/HL7** para interoperabilidade
- ⏳ Em desenvolvimento ativo

## 📋 Funcionalidades Principais

### 🧭 Navegação Oncológica

- Coordenação completa da jornada do paciente (rastreio → diagnóstico → tratamento → seguimento)
- Etapas automáticas baseadas no tipo de câncer
- Detecção de atrasos e alertas proativos
- Suporte para múltiplos tipos de câncer (colorretal, mama, pulmão, próstata, etc.)

### 🤖 Agente de IA WhatsApp

- Conversação natural com pacientes via WhatsApp Business API
- Triagem inicial e coleta de informações
- Orientação sobre exames e procedimentos
- Integração com sistema de navegação oncológica

### 📊 Dashboard e Priorização

- Visualização consolidada de todos os pacientes
- Priorização inteligente baseada em IA (XGBoost)
- Alertas em tempo real via WebSocket
- Filtros e buscas avançadas

### 🚨 Sistema de Alertas

- Alertas automáticos para etapas atrasadas
- Notificações de exames pendentes
- Alertas de estadiamento incompleto
- Avisos de atraso no tratamento

## Estrutura do Projeto

```
ONCONAV/
├── frontend/              # Next.js 14 (React + TypeScript) - porta 3000
├── backend/               # NestJS (Node.js + TypeScript) - porta 3002
├── ai-service/            # Python FastAPI (IA/ML) - porta 8001
├── docs/                  # Documentação completa
└── docker-compose.yml     # Ambiente de desenvolvimento (PostgreSQL, Redis, RabbitMQ)
```

## Stack Tecnológico

- **Frontend**: Next.js 14 (React + TypeScript)
- **Backend**: NestJS (Node.js + TypeScript)
- **IA/ML**: Python (FastAPI), GPT-4/Claude, XGBoost
- **Database**: PostgreSQL (multi-tenant)
- **WhatsApp**: WhatsApp Business API
- **Integração**: HL7/FHIR

## 📚 Documentação

Consulte a documentação completa em `docs/`:

### Documentação Técnica

- **Arquitetura**: Stack tecnológico, estrutura de dados, integrações HL7/FHIR
- **IA e Machine Learning**: Modelos de priorização, agente WhatsApp, RAG
- **Desenvolvimento**: Setup, comandos úteis, templates e exemplos
- **Navegação Oncológica**: Implementação, regras por tipo de câncer, protocolos

### Documentação de Produto

- **Product Discovery**: Pesquisas, personas, jobs-to-be-done
- **MVP Scope**: Features do MVP, roadmap
- **Pitch Deck**: Apresentação para investidores
- **Compliance**: Checklist LGPD, ANVISA, segurança

### Guias de Desenvolvimento

- **Regras de Desenvolvimento**: `.cursor/rules/desenvolvimento-modular.mdc`
- **Padrões Frontend**: `.cursor/rules/frontend-padroes.mdc`
- **Padrões Backend**: `.cursor/rules/backend-padroes.mdc`
- **Navegação Oncológica**: `.cursor/rules/navegacao-oncologica.mdc`

## Desenvolvimento

### Pré-requisitos

- Node.js 18+
- Python 3.11+
- PostgreSQL 15+
- Docker e Docker Compose

### Setup Inicial

```bash
# 1. Dependências (raiz + cada serviço)
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
cd ai-service && pip install -r requirements.txt && cd ..

# 2. Variáveis de ambiente
cp .env.example .env
cp .env.example backend/.env
cp .env.example frontend/.env.local
# Edite os arquivos conforme necessário

# 3. Infra local (PostgreSQL, Redis, RabbitMQ)
npm run docker:up   # equivale a docker-compose up -d

# 4. Aplicar migrations
npm run db:migrate

# 5. Popular banco com dados de teste (IMPORTANTE!)
cd backend && npx prisma db seed && cd ..

# 6. Ambiente de desenvolvimento (Frontend + Backend + AI Service)
npm run dev
```

### 🔑 Credenciais de Teste

Após executar o seed, use estas credenciais para acessar o sistema:

| Usuário       | Email                           | Senha      | Perfil      |
| ------------- | ------------------------------- | ---------- | ----------- |
| Administrador | `admin@hospitalteste.com`       | `senha123` | ADMIN       |
| Oncologista   | `oncologista@hospitalteste.com` | `senha123` | ONCOLOGIST  |
| Enfermeira    | `enfermeira@hospitalteste.com`  | `senha123` | NURSE       |
| Coordenador   | `coordenador@hospitalteste.com` | `senha123` | COORDINATOR |

### 🌐 URLs dos Serviços

| Serviço     | URL                          | Descrição               |
| ----------- | ---------------------------- | ----------------------- |
| Frontend    | http://localhost:3000        | Interface web (Next.js) |
| Backend API | http://localhost:3002/api/v1 | API REST (NestJS)       |
| AI Service  | http://localhost:8001        | Serviço de IA (FastAPI) |
| PostgreSQL  | localhost:5432               | Banco de dados          |
| Redis       | localhost:6379               | Cache                   |
| RabbitMQ    | localhost:5672 / 15672       | Mensageria / Dashboard  |

> `npm run dev` sobe os três serviços simultaneamente.  
> Se `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` não estiverem definidos, o AI Service responde com mensagens mockadas
> (útil para desenvolvimento). Para trabalhar com WhatsApp Embedded Signup/Meta, use `npm run dev:https`.

⚙️ **Husky**: após instalar as dependências, execute `npm run prepare` para reinstalar os Git hooks (pre-commit/pre-push).

### 🧪 Interface interativa (paciente x agente)

Para testar o agente manualmente como se você fosse o paciente (sem pytest), rode:

```bash
python ai-service/scripts/chat_patient_agent.py
```

Comandos disponíveis no chat: `/state`, `/history`, `/reset`, `/exit`.

> O script lê `OPENAI_API_KEY` e `ANTHROPIC_API_KEY` a partir do arquivo `.env` na raiz do repositório.

📘 Guia completo (pré-requisitos, troubleshooting e deploy):  
`docs/desenvolvimento/setup-e-deploy.md`

### Deploy Local/Produção

```bash
# 1. Build
npm run build  # Next.js + NestJS

# 2. Aplicar migrations em modo não-destrutivo
cd backend && npx prisma migrate deploy

# 3. Iniciar serviços em modo produção
npm run start  # next start + nest start + uvicorn
```

Para executar os processos em background em servidores, utilize um process manager (PM2, systemd, etc.).  
O AI Service também pode ser iniciado isoladamente via `npm run ai:dev` caso precise depurar somente o modelo.

### Ferramentas de Qualidade

O projeto inclui configuração completa de:

- ✅ **ESLint**: Linter para TypeScript/JavaScript
- ✅ **Prettier**: Formatador automático de código
- ✅ **Jest**: Framework de testes (Backend)
- ✅ **Husky**: Git hooks (validação antes de commit/push)
- ✅ **lint-staged**: Lint apenas arquivos modificados

**Comandos principais:**

```bash
# Lint
npm run lint              # Frontend
cd backend && npm run lint # Backend

# Formatação
npm run format            # Formatar tudo
npm run format:check      # Verificar sem modificar

# Testes
cd backend && npm test    # Rodar testes
cd backend && npm run test:cov # Com cobertura
```

**Documentação completa:**

- [Estado Atual e Próximos Passos](docs/desenvolvimento/estado-atual-proximos-passos.md) ⭐ **COMEÇE AQUI**
- [Setup de Configuração](docs/desenvolvimento/setup-configuracao.md)
- [Comandos Úteis](docs/desenvolvimento/comandos-uteis.md)
- [Navegação Oncológica - Implementação](docs/desenvolvimento/navegacao-oncologica-implementacao.md)
- [Navegação Oncológica - Câncer Colorretal](docs/desenvolvimento/navegacao-oncologica-colorretal.md)
- [Regras Gerais de Desenvolvimento](.cursor/rules/desenvolvimento-modular.mdc)
- [Padrões Frontend (Next.js)](.cursor/rules/frontend-padroes.mdc)
- [Padrões Backend (NestJS)](.cursor/rules/backend-padroes.mdc)
- [Atualizações em Tempo Real (WebSocket)](docs/arquitetura/realtime-updates.md)

## 🔗 Links Úteis

- **Repositório GitHub**: [github.com/luizfiorimr/OncoNav](https://github.com/luizfiorimr/OncoNav)
- **Documentação Completa**: Ver pasta `docs/`

## 📝 Licença

Proprietário - Todos os direitos reservados
