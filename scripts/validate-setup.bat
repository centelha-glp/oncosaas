@echo off
REM Script de validação do setup de desenvolvimento (Windows)
REM Verifica se todas as ferramentas estão configuradas corretamente

echo 🔍 Validando configuração do projeto...
echo.

set ERRORS=0

REM Verificar Node.js
echo Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Node.js instalado
    node --version
) else (
    echo ✗ Node.js não instalado
    set /a ERRORS+=1
)

REM Verificar npm
echo Verificando npm...
npm --version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ npm instalado
    npm --version
) else (
    echo ✗ npm não instalado
    set /a ERRORS+=1
)

REM Verificar Python
echo Verificando Python...
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Python instalado
    python --version
) else (
    echo ✗ Python não instalado
    set /a ERRORS+=1
)

echo.
echo 📦 Verificando configurações...

REM Verificar Husky
if exist ".husky\pre-commit" (
    echo ✓ Husky configurado
) else (
    echo ✗ Husky não configurado
    set /a ERRORS+=1
)

REM Verificar ESLint Frontend
if exist "frontend\.eslintrc.json" (
    echo ✓ ESLint (Frontend) configurado
) else (
    echo ✗ ESLint (Frontend) não configurado
    set /a ERRORS+=1
)

REM Verificar ESLint Backend
if exist "backend\.eslintrc.json" (
    echo ✓ ESLint (Backend) configurado
) else (
    echo ✗ ESLint (Backend) não configurado
    set /a ERRORS+=1
)

REM Verificar Prettier
if exist ".prettierrc" (
    echo ✓ Prettier configurado
) else (
    echo ✗ Prettier não configurado
    set /a ERRORS+=1
)

echo.
if %ERRORS% equ 0 (
    echo ✅ Tudo configurado corretamente!
    exit /b 0
) else (
    echo ❌ Encontrados %ERRORS% problema(s)
    echo.
    echo Execute: npm run prepare
    exit /b 1
)

