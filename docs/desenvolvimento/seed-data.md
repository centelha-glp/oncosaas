# Seed Data - Dados Iniciais para Desenvolvimento

## Visão Geral

O projeto inclui um script de seed (`prisma/seed.ts`) que popula o banco de dados com dados iniciais para facilitar o desenvolvimento e testes.

## Como Executar

```bash
cd backend
npm run prisma:seed
```

## Dados Criados

### 1. Tenant

- **Nome**: Hospital de Teste
- **Schema Name**: `hospital_teste`
- **Configurações**: Timezone (America/Sao_Paulo), Idioma (pt-BR)

### 2. Usuários de Teste

Todos os usuários têm a senha padrão: `senha123`

| Email                           | Nome            | Role        | Descrição                |
| ------------------------------- | --------------- | ----------- | ------------------------ |
| `admin@hospitalteste.com`       | Administrador   | ADMIN       | Acesso total ao sistema  |
| `oncologista@hospitalteste.com` | Dr. João Silva  | ONCOLOGIST  | Oncologista clínico      |
| `enfermeira@hospitalteste.com`  | Maria Santos    | NURSE       | Enfermeira responsável   |
| `coordenador@hospitalteste.com` | Carlos Oliveira | COORDINATOR | Coordenador de navegação |

### 3. Pacientes de Exemplo

#### Paciente 1: Ana Paula Costa

- **Tipo de Câncer**: Mama (breast)
- **Estágio**: IIIA
- **Status**: Em Tratamento (IN_TREATMENT)
- **Prioridade**: ALTA (score: 75)
- **Jornada**: Criada com histórico completo (rastreio → diagnóstico → tratamento)

#### Paciente 2: Roberto Almeida

- **Tipo de Câncer**: Pulmão (Pulmão)
- **Estágio**: IV
- **Status**: Em Tratamento (IN_TREATMENT)
- **Prioridade**: CRÍTICA (score: 90)
- **Alerta**: Alerta crítico criado (febre + dispneia)

#### Paciente 3: Fernanda Lima

- **Tipo de Câncer**: Colorretal (colorectal)
- **Estágio**: II
- **Status**: Em Seguimento (FOLLOW_UP)
- **Prioridade**: BAIXA (score: 30)

### 4. Mensagens de Exemplo

- **Mensagem 1** (INBOUND): Paciente reporta náusea
- **Mensagem 2** (OUTBOUND): Agente responde perguntando escala de intensidade

### 5. Alertas de Exemplo

- **Alerta Crítico**: Paciente Roberto Almeida
  - Tipo: CRITICAL_SYMPTOM
  - Severidade: CRITICAL
  - Mensagem: "Paciente reportou febre acima de 38°C e falta de ar"
  - Status: PENDING

## Uso em Testes

### Autenticação

```bash
# Login como enfermeira
POST /api/v1/auth/login
{
  "email": "enfermeira@hospitalteste.com",
  "password": "senha123"
}
```

### Listar Pacientes

```bash
GET /api/v1/patients
Authorization: Bearer <token>
```

### Listar Mensagens

```bash
GET /api/v1/messages?patientId=<patient-id>
Authorization: Bearer <token>
```

### Listar Alertas

```bash
GET /api/v1/alerts
Authorization: Bearer <token>
```

## Limpeza e Reset

Para resetar o banco e executar o seed novamente:

```bash
cd backend
npx prisma migrate reset  # Remove todos os dados e executa migrations + seed
```

Ou apenas executar o seed novamente (usa upsert para evitar duplicatas):

```bash
npm run prisma:seed
```

## Próximos Passos

- [ ] Adicionar mais pacientes de exemplo
- [ ] Criar conversas completas (múltiplas mensagens)
- [ ] Adicionar questionários respondidos
- [ ] Criar histórico de scores de priorização
- [ ] Adicionar observações clínicas (FHIR)
