# Arquivos de Configuração - Guia Completo

Este documento explica para que servem os arquivos de configuração adicionais e por que são essenciais para manter qualidade e consistência no projeto.

---

## 📋 Visão Geral

Os arquivos de configuração são ferramentas que **automatizam** e **padronizam** o desenvolvimento, garantindo que todo código siga as mesmas regras e padrões, mesmo com múltiplos desenvolvedores trabalhando no projeto.

**Benefícios:**

- ✅ Consistência de código entre desenvolvedores
- ✅ Detecção automática de erros antes de commitar
- ✅ Formatação automática (sem discussões sobre estilo)
- ✅ Prevenção de bugs através de testes automáticos
- ✅ Economia de tempo (não precisa revisar manualmente)

---

## 1. ESLint - Linter de Código

### O que é?

**ESLint** é uma ferramenta que **analisa seu código** e encontra problemas potenciais, erros de sintaxe, más práticas e violações de padrões de código.

### Para que serve?

- 🔍 **Detecta erros antes de executar**: Encontra problemas que o TypeScript não pega
- 📏 **Enforce padrões**: Garante que todos sigam as mesmas regras
- 🚫 **Previne bugs**: Identifica código problemático antes de ir para produção
- 📚 **Ensina boas práticas**: Mostra como escrever código melhor

### Exemplo Prático

**Sem ESLint:**

```typescript
// Código com problemas que passaria despercebido
function getPatient(id) {
  // ❌ Sem tipo, sem validação
  return patients.find((p) => p.id == id); // ❌ == em vez de ===
}

const data = null;
console.log(data.name); // ❌ Vai dar erro em runtime!
```

**Com ESLint configurado:**

```typescript
// ESLint força você a escrever melhor
function getPatient(id: string): Patient | undefined {
  // ✅ Tipado
  return patients.find((p) => p.id === id); // ✅ === correto
}

const data = null;
// ESLint avisa: "Cannot read property 'name' of null" ANTES de executar
```

### Arquivo de Configuração

```json
// .eslintrc.json (Frontend)
{
  "extends": [
    "next/core-web-vitals", // Regras do Next.js
    "plugin:@typescript-eslint/recommended" // Regras TypeScript
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error", // Proíbe usar 'any'
    "@typescript-eslint/explicit-function-return-type": "warn", // Avisa se falta tipo de retorno
    "no-console": ["warn", { "allow": ["warn", "error"] }] // Só permite console.warn/error
  }
}
```

**Como usar:**

```bash
# Verificar erros
npm run lint

# Corrigir automaticamente (quando possível)
npm run lint -- --fix
```

---

## 2. Prettier - Formatador de Código

### O que é?

**Prettier** é um formatador automático de código que **padroniza a formatação** (espaços, quebras de linha, aspas, etc.) sem discutir estilo.

### Para que serve?

- 🎨 **Formatação automática**: Remove discussões sobre "espaço aqui ou ali"
- ⏱️ **Economiza tempo**: Não precisa formatar manualmente
- 🤝 **Consistência**: Todo código fica igual, independente de quem escreveu
- 🔄 **Integração com editor**: Formata automaticamente ao salvar

### Exemplo Prático

**Antes do Prettier** (cada desenvolvedor formata diferente):

```typescript
// Desenvolvedor A
function getPatient(id: string) {
  return patients.find((p) => p.id === id);
}

// Desenvolvedor B
function getPatient(id: string) {
  return patients.find((p) => p.id === id);
}

// Desenvolvedor C
function getPatient(id: string) {
  return patients.find((p) => p.id === id);
}
```

**Depois do Prettier** (todos ficam iguais):

```typescript
// Prettier formata automaticamente para o mesmo estilo
function getPatient(id: string) {
  return patients.find((p) => p.id === id);
}
```

### Arquivo de Configuração

```json
// .prettierrc
{
  "semi": true, // Usa ponto e vírgula
  "trailingComma": "es5", // Vírgula final em arrays/objetos
  "singleQuote": true, // Aspas simples em vez de duplas
  "printWidth": 80, // Quebra linha em 80 caracteres
  "tabWidth": 2 // 2 espaços por indentação
}
```

**Como usar:**

```bash
# Formatar todos os arquivos
npm run format

# Formatar apenas arquivos modificados (com Husky)
# Roda automaticamente antes de commitar
```

---

## 3. Jest - Framework de Testes

### O que é?

**Jest** é um framework de testes que permite escrever e executar testes automatizados para garantir que o código funciona corretamente.

### Para que serve?

- ✅ **Validação automática**: Testa se o código funciona como esperado
- 🐛 **Detecção de bugs**: Encontra problemas antes de ir para produção
- 📝 **Documentação viva**: Testes mostram como o código deve ser usado
- 🔄 **Refatoração segura**: Permite mudar código sabendo que testes vão quebrar se algo der errado
- 📊 **Cobertura**: Mostra quanto do código está testado

### Exemplo Prático

**Sem testes:**

```typescript
// Código sem testes - você não sabe se funciona
function calculatePriority(patient: Patient): number {
  // Lógica complexa aqui...
  return score;
}

// Você precisa testar manualmente toda vez que mudar algo 😰
```

**Com testes:**

```typescript
// patients.service.spec.ts
describe('calculatePriority', () => {
  it('should return high priority for critical symptoms', () => {
    const patient = {
      symptoms: { fever: 39, pain: 9 },
      stage: 'IV',
    };

    const result = calculatePriority(patient);

    expect(result).toBeGreaterThan(80); // ✅ Teste automático
  });
});

// Roda automaticamente: npm test
// ✅ Passou? Código funciona!
// ❌ Falhou? Tem bug!
```

### Arquivo de Configuração

```javascript
// jest.config.js (Backend)
module.exports = {
  preset: 'ts-jest', // Usa TypeScript
  testEnvironment: 'node', // Ambiente Node.js
  coverageDirectory: 'coverage', // Onde salvar relatório de cobertura
  collectCoverageFrom: [
    'src/**/*.ts', // Testar todos os arquivos .ts
    '!src/**/*.spec.ts', // Exceto arquivos de teste
    '!src/main.ts', // Exceto entry point
  ],
  coverageThreshold: {
    global: {
      branches: 70, // 70% das branches testadas
      functions: 70, // 70% das funções testadas
      lines: 70, // 70% das linhas testadas
      statements: 70, // 70% das statements testadas
    },
  },
};
```

**Como usar:**

```bash
# Rodar todos os testes
npm test

# Rodar testes em modo watch (re-executa ao mudar arquivos)
npm test -- --watch

# Ver cobertura de testes
npm test -- --coverage
```

---

## 4. Husky - Git Hooks

### O que é?

**Husky** permite executar scripts automaticamente em eventos do Git (antes de commitar, antes de fazer push, etc.).

### Para que serve?

- 🛡️ **Validação automática**: Impede commits com código quebrado
- ✅ **Garantia de qualidade**: Só permite commit se testes passarem
- 🎨 **Formatação automática**: Formata código antes de commitar
- 🚫 **Prevenção de erros**: Bloqueia commits com problemas

### Exemplo Prático

**Sem Husky:**

```bash
# Desenvolvedor commita código quebrado
git commit -m "feat: adiciona nova feature"
# ✅ Commit aceito (mesmo com erros!)

# No CI/CD, build quebra 😰
# Time perde tempo investigando
```

**Com Husky:**

```bash
# Desenvolvedor tenta commitar código quebrado
git commit -m "feat: adiciona nova feature"

# Husky executa automaticamente:
# 1. npm run lint     → ❌ Encontrou erros!
# 2. npm run test    → ❌ Testes falharam!
# 3. npm run format  → ✅ Formata código

# ❌ Commit REJEITADO até corrigir erros
# ✅ Desenvolvedor corrige antes de commitar
```

### Arquivo de Configuração

```json
// package.json
{
  "scripts": {
    "prepare": "husky install" // Instala Husky automaticamente
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix", // Corrige erros do ESLint
      "prettier --write" // Formata código
    ],
    "*.{json,md}": [
      "prettier --write" // Formata JSON e Markdown
    ]
  }
}
```

```bash
# .husky/pre-commit (arquivo criado pelo Husky)
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Executa antes de cada commit
npm run lint-staged    # Lint e formata apenas arquivos modificados
npm test              # Roda testes (rápido)
```

**Como funciona:**

1. Desenvolvedor faz `git commit`
2. Husky executa `pre-commit` hook automaticamente
3. Se algo falhar, commit é bloqueado
4. Desenvolvedor corrige e tenta novamente

---

## 5. lint-staged - Lint Apenas Arquivos Modificados

### O que é?

**lint-staged** executa linters e formatadores apenas nos arquivos que foram modificados no commit atual (não em todo o projeto).

### Para que serve?

- ⚡ **Performance**: Muito mais rápido que lintar todo o projeto
- 🎯 **Foco**: Só valida o que você mudou
- ⏱️ **Economia de tempo**: Commits rápidos mesmo em projetos grandes

### Exemplo Prático

**Sem lint-staged:**

```bash
# Você modificou apenas 1 arquivo
git add src/patients/patients.service.ts

# Husky executa lint em TODO o projeto (500+ arquivos)
# ⏱️ Demora 2 minutos...
```

**Com lint-staged:**

```bash
# Você modificou apenas 1 arquivo
git add src/patients/patients.service.ts

# lint-staged executa lint APENAS nesse arquivo
# ⏱️ Demora 2 segundos...
```

---

## 📦 Como Instalar e Configurar

### 1. Instalar Dependências

```bash
# Frontend
cd frontend
npm install --save-dev eslint prettier eslint-config-prettier husky lint-staged

# Backend
cd backend
npm install --save-dev @typescript-eslint/parser @typescript-eslint/eslint-plugin jest @typescript/jest husky lint-staged
```

### 2. Criar Arquivos de Configuração

**Frontend `.eslintrc.json`:**

```json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
```

**`.prettierrc` (raiz do projeto):**

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

**`package.json` (adicionar scripts):**

```json
{
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,json,md}\"",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "prepare": "husky install"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

### 3. Configurar Husky

```bash
# Instalar Husky
npm run prepare

# Criar pre-commit hook
npx husky add .husky/pre-commit "npm run lint-staged"
npx husky add .husky/pre-commit "npm test"

# Criar pre-push hook (opcional - mais rigoroso)
npx husky add .husky/pre-push "npm run lint"
npx husky add .husky/pre-push "npm test"
```

---

## 🎯 Resumo: Por que são Importantes?

| Ferramenta      | Problema que Resolve                              | Benefício                               |
| --------------- | ------------------------------------------------- | --------------------------------------- |
| **ESLint**      | Código inconsistente, erros não detectados        | Detecta problemas automaticamente       |
| **Prettier**    | Discussões sobre formatação, código inconsistente | Formatação automática padronizada       |
| **Jest**        | Bugs em produção, código não testado              | Validação automática de funcionalidades |
| **Husky**       | Commits com código quebrado                       | Bloqueia commits ruins automaticamente  |
| **lint-staged** | Lint lento em projetos grandes                    | Valida apenas arquivos modificados      |

---

## ✅ Checklist de Setup

- [ ] Instalar dependências (ESLint, Prettier, Jest, Husky)
- [ ] Criar `.eslintrc.json` com regras do projeto
- [ ] Criar `.prettierrc` com estilo de formatação
- [ ] Criar `jest.config.js` com configuração de testes
- [ ] Adicionar scripts no `package.json`
- [ ] Configurar Husky hooks (pre-commit, pre-push)
- [ ] Testar: fazer commit e verificar se hooks funcionam
- [ ] Documentar no README como usar cada ferramenta

---

## 🚀 Próximos Passos

Depois de configurar, você terá:

1. ✅ **Código consistente** automaticamente
2. ✅ **Erros detectados** antes de commitar
3. ✅ **Testes rodando** automaticamente
4. ✅ **Formatação padronizada** sem esforço manual
5. ✅ **Qualidade garantida** em cada commit

**Quer que eu crie esses arquivos de configuração agora?** Posso gerar todos os arquivos prontos para uso! 🎉

---

**Última atualização**: 2026-04-13  
**Versão**: 1.0.0
