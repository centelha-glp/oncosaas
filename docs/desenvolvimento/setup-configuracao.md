# Setup de Configuração - ESLint, Prettier, Jest e Husky

Guia passo a passo para configurar todas as ferramentas de qualidade de código.

---

## 📋 Pré-requisitos

- Node.js 18+ instalado
- npm ou yarn instalado
- Git inicializado no projeto

---

## 🚀 Passo a Passo

### 1. Instalar Dependências

#### Frontend

```bash
cd frontend
npm install --save-dev \
  @typescript-eslint/eslint-plugin@^7.13.1 \
  @typescript-eslint/parser@^7.13.1 \
  eslint-config-prettier@^9.1.0 \
  prettier@^3.3.2
```

#### Backend

```bash
cd backend
npm install --save-dev \
  @typescript-eslint/eslint-plugin@^7.13.1 \
  @typescript-eslint/parser@^7.13.1 \
  eslint-config-prettier@^9.1.0 \
  prettier@^3.3.2
```

#### Raiz do Projeto (Husky)

```bash
# Na raiz do projeto
npm install --save-dev \
  husky@^9.0.11 \
  lint-staged@^15.2.2 \
  prettier@^3.3.2
```

---

### 2. Configurar Husky

```bash
# Na raiz do projeto
npm run prepare

# Isso cria a estrutura .husky/
```

**Verificar se foi criado:**

```bash
ls -la .husky/
# Deve mostrar: pre-commit, pre-push, _/
```

---

### 3. Tornar Scripts Executáveis (Linux/Mac)

```bash
chmod +x .husky/pre-commit
chmod +x .husky/pre-push
chmod +x .husky/_/husky.sh
```

**Windows:** Não precisa (Git Bash cuida disso)

---

### 4. Testar Configuração

#### Testar ESLint

```bash
# Frontend
cd frontend
npm run lint

# Backend
cd backend
npm run lint
```

#### Testar Prettier

```bash
# Formatar todos os arquivos
npm run format

# Verificar formatação (sem modificar)
npm run format:check
```

#### Testar Jest

```bash
# Backend
cd backend
npm test

# Com cobertura
npm run test:cov
```

#### Testar Husky

```bash
# Criar um arquivo de teste
echo "const test = 'test'" > test.ts

# Adicionar ao staging
git add test.ts

# Tentar commitar (deve executar lint-staged)
git commit -m "test: test husky"

# Se funcionou, você verá o lint-staged executando
# Depois pode deletar o arquivo de teste
rm test.ts
git reset HEAD test.ts
```

---

## ✅ Verificação Final

Execute este checklist:

- [ ] `npm run lint` funciona no frontend
- [ ] `npm run lint` funciona no backend
- [ ] `npm run format` formata arquivos
- [ ] `npm run format:check` detecta arquivos não formatados
- [ ] `npm test` roda testes no backend
- [ ] `npm run prepare` instala Husky
- [ ] `.husky/pre-commit` existe e é executável
- [ ] `.husky/pre-push` existe e é executável
- [ ] Tentar commitar executa lint-staged automaticamente

---

## 🎯 Como Usar no Dia a Dia

### Antes de Commitar

```bash
# 1. Verificar lint manualmente (opcional)
npm run lint

# 2. Formatar código (opcional - Husky faz automaticamente)
npm run format

# 3. Commitar normalmente
git add .
git commit -m "feat: nova feature"

# Husky executa automaticamente:
# - lint-staged (lint + format apenas arquivos modificados)
# - Se algo falhar, commit é bloqueado
```

### Antes de Push

```bash
# Husky executa automaticamente no pre-push:
# - Lint completo
# - Verificação de formatação
# - Testes completos

git push origin develop

# Se algo falhar, push é bloqueado até corrigir
```

### Rodar Testes Manualmente

```bash
# Backend
cd backend
npm test              # Todos os testes
npm run test:watch    # Modo watch
npm run test:cov      # Com cobertura
```

---

## 🔧 Troubleshooting

### Erro: "husky: command not found"

**Solução:**

```bash
npm run prepare
```

### Erro: "lint-staged: command not found"

**Solução:**

```bash
npm install --save-dev lint-staged
```

### Erro: "Permission denied" no Husky (Linux/Mac)

**Solução:**

```bash
chmod +x .husky/pre-commit
chmod +x .husky/pre-push
chmod +x .husky/_/husky.sh
```

### Husky não executa no commit

**Solução:**

1. Verificar se `.husky/pre-commit` existe
2. Verificar se é executável: `ls -la .husky/pre-commit`
3. Reinstalar: `npm run prepare`
4. Verificar se `prepare` script está no `package.json`

### ESLint encontra muitos erros

**Solução:**

```bash
# Corrigir automaticamente (quando possível)
npm run lint:fix

# Ou no backend
cd backend && npm run lint
```

### Prettier não formata

**Solução:**

```bash
# Verificar se .prettierrc existe na raiz
cat .prettierrc

# Formatar manualmente
npm run format
```

---

## 📚 Comandos Úteis

### Lint

```bash
# Frontend
cd frontend && npm run lint

# Backend
cd backend && npm run lint

# Verificar sem corrigir
cd backend && npm run lint:check
```

### Formatação

```bash
# Formatar tudo
npm run format

# Verificar sem modificar
npm run format:check

# Formatar apenas frontend
cd frontend && npm run format
```

### Testes

```bash
# Backend - todos os testes
cd backend && npm test

# Backend - modo watch
cd backend && npm run test:watch

# Backend - com cobertura
cd backend && npm run test:cov

# Backend - type check
cd backend && npm run type-check
```

### Type Check

```bash
# Frontend
cd frontend && npm run type-check

# Backend
cd backend && npm run type-check
```

---

## 🎨 Configuração do Editor (VSCode)

### Recomendações de Extensões

1. **ESLint** (dbaeumer.vscode-eslint)
2. **Prettier** (esbenp.prettier-vscode)
3. **TypeScript** (vscode.typescript-language-features)

### Configuração do VSCode (`.vscode/settings.json`)

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[markdown]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

---

## 📝 Próximos Passos

Após configurar tudo:

1. ✅ Testar commit com código quebrado (deve bloquear)
2. ✅ Testar commit com código correto (deve passar)
3. ✅ Configurar VSCode para formatar ao salvar
4. ✅ Escrever primeiro teste unitário
5. ✅ Documentar padrões específicos do projeto

---

**Última atualização**: 2026-04-13  
**Versão**: 1.0.0
