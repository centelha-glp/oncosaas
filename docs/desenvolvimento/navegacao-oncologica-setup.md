# Setup - Navegação Oncológica

## ⚠️ Status Atual

✅ **Migration criada e aplicada** no banco de dados  
⚠️ **Prisma Client precisa ser regenerado** (arquivo travado pelo servidor)

## 🔧 Solução

### Passo 1: Parar o servidor backend

Se o servidor NestJS estiver rodando, pare-o (Ctrl+C no terminal onde está rodando).

### Passo 2: Regenerar Prisma Client

```bash
cd backend
npx prisma generate
```

### Passo 3: Reiniciar o servidor

```bash
npm run start:dev
```

## ✅ Verificação

Após regenerar, os erros TypeScript devem desaparecer:

- ✅ `NavigationStepStatus` disponível em `@prisma/client`
- ✅ `prisma.navigationStep` disponível no PrismaService
- ✅ `AlertType.NAVIGATION_DELAY` e outros novos tipos disponíveis

## 📝 Migration Aplicada

A migration `20251113014913_add_oncology_navigation` foi aplicada com sucesso e criou:

- ✅ Enum `NavigationStepStatus`
- ✅ Novos valores no enum `AlertType`:
  - `NAVIGATION_DELAY`
  - `MISSING_EXAM`
  - `STAGING_INCOMPLETE`
  - `TREATMENT_DELAY`
  - `FOLLOW_UP_OVERDUE`
- ✅ Tabela `navigation_steps` com todos os campos e índices
- ✅ Foreign keys e relacionamentos

## 🧪 Teste Rápido

Após regenerar o Prisma Client:

1. Criar paciente com câncer colorretal:

```bash
POST /api/v1/patients
{
  "name": "Teste Navegação",
  "birthDate": "1970-01-01",
  "phone": "+5511999999999",
  "cancerType": "colorectal",
  "currentStage": "DIAGNOSIS"
}
```

2. Verificar etapas criadas:

```bash
GET /api/v1/oncology-navigation/patients/{patientId}/steps
```

3. Verificar no frontend:
   - Acessar dashboard
   - Selecionar paciente
   - Verificar painel de navegação oncológica

---

**Última atualização:** 2026-04-13
