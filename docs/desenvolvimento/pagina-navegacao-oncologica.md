# Página de Navegação Oncológica

## Visão Geral

Página dedicada para visualização consolidada da navegação oncológica de todos os pacientes, organizada por tipo de câncer.

## Funcionalidades

### 1. Agrupamento por Tipo de Câncer

- Lista todos os tipos de câncer presentes no sistema
- Mostra contagem de pacientes por tipo
- Permite filtrar por tipo específico ou ver todos

### 2. Visualização de Pacientes

- Para cada tipo de câncer, lista todos os pacientes
- Mostra informações resumidas:
  - Nome do paciente
  - Etapa atual da jornada
  - Progresso de etapas (concluídas/total)
  - Etapas atrasadas

### 3. Detalhamento de Etapas

- Ao expandir um paciente, mostra todas as etapas de navegação
- Organizadas por fase da jornada (SCREENING, DIAGNOSIS, TREATMENT, FOLLOW_UP)
- Cada etapa mostra:
  - Status (PENDING, IN_PROGRESS, COMPLETED, OVERDUE, etc.)
  - Nome e descrição
  - Datas (esperada, prazo, concluída)
  - Se é obrigatória ou não

### 4. Indicadores Visuais

- Cores por status:
  - **PENDING**: Cinza
  - **IN_PROGRESS**: Azul
  - **COMPLETED**: Verde
  - **OVERDUE**: Vermelho
  - **CANCELLED**: Amarelo
- Etapa atual destacada com borda azul
- Contadores de etapas concluídas e atrasadas

## Estrutura da Página

### Rota

- `/oncology-navigation`

### Componentes Principais

1. **OncologyNavigationPage** (componente principal)
   - Gerencia estado de filtros
   - Agrupa pacientes por tipo de câncer
   - Renderiza lista de tipos de câncer e pacientes

2. **PatientNavigationCard** (componente de paciente)
   - Mostra informações resumidas do paciente
   - Expande/colapsa para mostrar etapas detalhadas
   - Carrega etapas de navegação via hook

### Hooks Utilizados

- `usePatients()`: Lista todos os pacientes
- `usePatientNavigationSteps(patientId)`: Etapas de navegação de um paciente específico

### Filtros

- **Todos**: Mostra todos os pacientes de todos os tipos
- **Por tipo**: Filtra apenas pacientes de um tipo específico de câncer

## Integração com Backend

### Endpoints Utilizados

- `GET /api/v1/oncology-navigation/patients/:patientId/steps`
  - Retorna todas as etapas de navegação de um paciente

### Dados Necessários

- Lista de pacientes com `cancerType` ou `cancerDiagnoses`
- Etapas de navegação para cada paciente

## Navegação

### Botão na Barra de Navegação

O botão "Navegação Oncológica" está disponível em:

- `/chat` (página de chat)
- `/dashboard` (página de dashboard)

Ao clicar, navega para `/oncology-navigation`.

## Tipos de Câncer Suportados

- Câncer de Mama (breast)
- Câncer de Pulmão (Pulmão)
- Câncer Colorretal (colorectal)
- Câncer de Próstata (prostate)
- Câncer de Rim (kidney)
- Câncer de Bexiga (bladder)
- Câncer de Testículo (testicular)
- Outros (other)

## Melhorias Futuras

- [ ] Adicionar filtros adicionais (etapa atual, status de etapas)
- [ ] Permitir atualizar etapas diretamente da página
- [ ] Adicionar exportação de relatórios
- [ ] Adicionar gráficos de progresso por tipo de câncer
- [ ] Adicionar busca por nome de paciente
- [ ] Adicionar ordenação (por nome, por progresso, por etapa atual)

---

**Última atualização**: 2024-01-XX
