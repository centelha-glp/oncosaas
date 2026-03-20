# Script PowerShell para gerar certificados SSL autoassinados no Windows
# Execute como Administrador: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

Write-Host "🔐 Gerando certificados SSL autoassinados para desenvolvimento local..." -ForegroundColor Cyan

# Criar diretório para certificados se não existir
$certDir = ".\certs"
if (-not (Test-Path $certDir)) {
    New-Item -ItemType Directory -Path $certDir | Out-Null
}

$domain = "localhost"
$days = 365
$keyFile = "$certDir\localhost.key"
$certFile = "$certDir\localhost.crt"
$pfxFile = "$certDir\localhost.pfx"

# Verificar se OpenSSL está instalado
$opensslPath = Get-Command openssl -ErrorAction SilentlyContinue
if (-not $opensslPath) {
    Write-Host "❌ OpenSSL não encontrado!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Instale o OpenSSL:" -ForegroundColor Yellow
    Write-Host "  - Via Chocolatey: choco install openssl" -ForegroundColor Yellow
    Write-Host "  - Ou baixe de: https://slproweb.com/products/Win32OpenSSL.html" -ForegroundColor Yellow
    exit 1
}

# Criar arquivo de configuração OpenSSL
$configContent = @"
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=BR
ST=Sao Paulo
L=Sao Paulo
O=ONCONAV Development
OU=Development
CN=localhost

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
"@

$configFile = "$certDir\openssl.conf"
$configContent | Out-File -FilePath $configFile -Encoding ASCII

# Gerar chave privada
Write-Host "📝 Gerando chave privada..." -ForegroundColor Yellow
& openssl genrsa -out $keyFile 2048

# Gerar certificado autoassinado
Write-Host "📜 Gerando certificado SSL..." -ForegroundColor Yellow
& openssl req -new -x509 -key $keyFile -out $certFile -days $days -config $configFile -extensions v3_req

# Gerar arquivo PFX (opcional, para Windows)
Write-Host "📦 Gerando arquivo PFX..." -ForegroundColor Yellow
& openssl pkcs12 -export -out $pfxFile -inkey $keyFile -in $certFile -passout pass: -nokeys

Write-Host ""
Write-Host "✅ Certificados gerados com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "📁 Localização dos arquivos:" -ForegroundColor Cyan
Write-Host "   Chave privada: $keyFile"
Write-Host "   Certificado:   $certFile"
Write-Host "   PFX:           $pfxFile"
Write-Host ""
Write-Host "⚠️  IMPORTANTE: Você precisa confiar neste certificado no Windows." -ForegroundColor Yellow
Write-Host ""
Write-Host "📋 Para instalar o certificado no Windows:" -ForegroundColor Cyan
Write-Host "   1. Clique duas vezes em $certFile"
Write-Host "   2. Clique em 'Instalar Certificado'"
Write-Host "   3. Selecione 'Usuário Atual' ou 'Computador Local'"
Write-Host "   4. Selecione 'Colocar todos os certificados no seguinte repositório'"
Write-Host "   5. Navegue até 'Repositório de Autoridades de Certificação Raiz Confiáveis'"
Write-Host "   6. Clique em Concluir"
Write-Host ""
Write-Host "Ou execute este comando PowerShell como Administrador:" -ForegroundColor Cyan
Write-Host "   Import-Certificate -FilePath '$certFile' -CertStoreLocation Cert:\CurrentUser\Root" -ForegroundColor White

