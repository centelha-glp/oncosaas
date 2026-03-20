# Script de teste da API ONCONAV (PowerShell)
# Uso: .\scripts\test-api.ps1

$BASE_URL = "http://localhost:3002/api/v1"
$TENANT_ID = ""
$ACCESS_TOKEN = ""

Write-Host "🧪 Testando API ONCONAV" -ForegroundColor Cyan
Write-Host "========================"
Write-Host ""

# Função para fazer login e obter token
function Login {
    Write-Host "🔐 Testando Login..." -ForegroundColor Yellow
    
    $body = @{
        email = "admin@hospitalteste.com"
        password = "senha123"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/auth/login" `
            -Method Post `
            -ContentType "application/json" `
            -Body $body
        
        $script:ACCESS_TOKEN = $response.access_token
        $script:TENANT_ID = $response.user.tenantId
        
        Write-Host "✅ Login bem-sucedido" -ForegroundColor Green
        Write-Host "Token: $($ACCESS_TOKEN.Substring(0, [Math]::Min(50, $ACCESS_TOKEN.Length)))..."
        Write-Host "Tenant ID: $TENANT_ID"
        Write-Host ""
        return $true
    }
    catch {
        Write-Host "❌ Login falhou" -ForegroundColor Red
        Write-Host $_.Exception.Message
        return $false
    }
}

# Função para testar endpoint
function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Endpoint,
        [object]$Data = $null,
        [string]$Description
    )
    
    Write-Host "📡 Testando: $Description" -ForegroundColor Yellow
    Write-Host "   $Method $Endpoint"
    
    $headers = @{
        "Authorization" = "Bearer $ACCESS_TOKEN"
        "X-Tenant-Id" = $TENANT_ID
    }
    
    try {
        if ($Data) {
            $body = $Data | ConvertTo-Json -Depth 10
            $response = Invoke-RestMethod -Uri "$BASE_URL$Endpoint" `
                -Method $Method `
                -Headers $headers `
                -ContentType "application/json" `
                -Body $body
        }
        else {
            $response = Invoke-RestMethod -Uri "$BASE_URL$Endpoint" `
                -Method $Method `
                -Headers $headers
        }
        
        Write-Host "✅ Sucesso" -ForegroundColor Green
        $response | ConvertTo-Json -Depth 5
    }
    catch {
        Write-Host "❌ Erro: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            Write-Host $_.ErrorDetails.Message
        }
    }
    Write-Host ""
}

# Executar testes
if (-not (Login)) {
    exit 1
}

Write-Host "📋 Testando Endpoints..." -ForegroundColor Cyan
Write-Host ""

# Teste 1: Listar pacientes
Test-Endpoint -Method "GET" -Endpoint "/patients" -Description "Listar Pacientes"

# Teste 2: Obter primeiro paciente (se existir)
try {
    $patients = Invoke-RestMethod -Uri "$BASE_URL/patients" `
        -Method Get `
        -Headers @{
            "Authorization" = "Bearer $ACCESS_TOKEN"
            "X-Tenant-Id" = $TENANT_ID
        }
    
    if ($patients -and $patients.Count -gt 0) {
        $PATIENT_ID = $patients[0].id
        
        Test-Endpoint -Method "GET" -Endpoint "/patients/$PATIENT_ID" -Description "Obter Paciente por ID"
        
        # Teste 3: Criar observação para o paciente
        $observationData = @{
            patientId = $PATIENT_ID
            code = "72514-3"
            display = "Pain severity"
            valueQuantity = 7
            unit = "/10"
            effectiveDateTime = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
            status = "final"
        }
        Test-Endpoint -Method "POST" -Endpoint "/observations" -Data $observationData -Description "Criar Observação Clínica"
        
        # Teste 4: Listar observações
        Test-Endpoint -Method "GET" -Endpoint "/observations?patientId=$PATIENT_ID" -Description "Listar Observações do Paciente"
        
        # Teste 5: Listar observações não sincronizadas
        Test-Endpoint -Method "GET" -Endpoint "/observations/unsynced" -Description "Listar Observações Não Sincronizadas"
        
        # Teste 6: Criar alerta para o paciente
        $alertData = @{
            patientId = $PATIENT_ID
            type = "CRITICAL_SYMPTOM"
            severity = "HIGH"
            message = "Teste de alerta - febre alta"
            context = @{
                symptoms = @("febre", "mal-estar")
                temperature = 38.5
            }
        }
        Test-Endpoint -Method "POST" -Endpoint "/alerts" -Data $alertData -Description "Criar Alerta"
    }
    else {
        Write-Host "⚠️  Nenhum paciente encontrado. Pulando testes que dependem de paciente." -ForegroundColor Yellow
        Write-Host ""
    }
}
catch {
    Write-Host "⚠️  Erro ao obter pacientes: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
}

# Teste 7: Listar mensagens
Test-Endpoint -Method "GET" -Endpoint "/messages" -Description "Listar Mensagens"

# Teste 8: Contar mensagens não assumidas
Test-Endpoint -Method "GET" -Endpoint "/messages/unassumed/count" -Description "Contar Mensagens Não Assumidas"

# Teste 9: Listar alertas
Test-Endpoint -Method "GET" -Endpoint "/alerts" -Description "Listar Alertas"

# Teste 10: Health check
Test-Endpoint -Method "GET" -Endpoint "/health" -Description "Health Check"

Write-Host "========================"
Write-Host "✅ Testes concluídos!" -ForegroundColor Green

