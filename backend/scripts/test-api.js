/**
 * Script de teste da API ONCONAV (Node.js)
 * Uso: node scripts/test-api.js
 */

const BASE_URL = 'http://localhost:3002/api/v1';

// Cores para console
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

let ACCESS_TOKEN = '';
let TENANT_ID = '';

/**
 * Fazer login e obter token
 */
async function login() {
  console.log(`${colors.yellow}🔐 Testando Login...${colors.reset}`);
  
  try {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@hospitalteste.com',
        password: 'senha123',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    ACCESS_TOKEN = data.access_token;
    TENANT_ID = data.user.tenantId;

    console.log(`${colors.green}✅ Login bem-sucedido${colors.reset}`);
    console.log(`Token: ${ACCESS_TOKEN.substring(0, 50)}...`);
    console.log(`Tenant ID: ${TENANT_ID}`);
    console.log('');
    return true;
  } catch (error) {
    console.error(`${colors.red}❌ Login falhou${colors.reset}`);
    console.error(error.message);
    return false;
  }
}

/**
 * Testar endpoint
 */
async function testEndpoint(method, endpoint, data = null, description) {
  console.log(`${colors.yellow}📡 Testando: ${description}${colors.reset}`);
  console.log(`   ${method} ${endpoint}`);

  const options = {
    method,
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'X-Tenant-Id': TENANT_ID,
    },
  };

  if (data) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const responseData = await response.json().catch(() => response.text());

    if (response.ok) {
      console.log(`${colors.green}✅ Sucesso (HTTP ${response.status})${colors.reset}`);
      console.log(JSON.stringify(responseData, null, 2));
    } else {
      console.log(`${colors.red}❌ Erro (HTTP ${response.status})${colors.reset}`);
      console.log(JSON.stringify(responseData, null, 2));
    }
  } catch (error) {
    console.error(`${colors.red}❌ Erro: ${error.message}${colors.reset}`);
  }
  console.log('');
}

/**
 * Executar todos os testes
 */
async function runTests() {
  console.log(`${colors.cyan}🧪 Testando API ONCONAV${colors.reset}`);
  console.log('========================');
  console.log('');

  // Login
  if (!(await login())) {
    process.exit(1);
  }

  console.log(`${colors.cyan}📋 Testando Endpoints...${colors.reset}`);
  console.log('');

  // Teste 1: Listar pacientes
  await testEndpoint('GET', '/patients', null, 'Listar Pacientes');

  // Teste 2: Obter primeiro paciente
  try {
    const patientsResponse = await fetch(`${BASE_URL}/patients`, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'X-Tenant-Id': TENANT_ID,
      },
    });
    const patients = await patientsResponse.json();

    if (patients && patients.length > 0) {
      const PATIENT_ID = patients[0].id;

      await testEndpoint('GET', `/patients/${PATIENT_ID}`, null, 'Obter Paciente por ID');

      // Teste 3: Criar observação
      const observationData = {
        patientId: PATIENT_ID,
        code: '72514-3',
        display: 'Pain severity',
        valueQuantity: 7,
        unit: '/10',
        effectiveDateTime: new Date().toISOString(),
        status: 'final',
      };
      await testEndpoint('POST', '/observations', observationData, 'Criar Observação Clínica');

      // Teste 4: Listar observações
      await testEndpoint(
        'GET',
        `/observations?patientId=${PATIENT_ID}`,
        null,
        'Listar Observações do Paciente'
      );

      // Teste 5: Listar observações não sincronizadas
      await testEndpoint('GET', '/observations/unsynced', null, 'Listar Observações Não Sincronizadas');

      // Teste 6: Criar alerta
      const alertData = {
        patientId: PATIENT_ID,
        type: 'CRITICAL_SYMPTOM',
        severity: 'HIGH',
        message: 'Teste de alerta - febre alta',
        context: {
          symptoms: ['febre', 'mal-estar'],
          temperature: 38.5,
        },
      };
      await testEndpoint('POST', '/alerts', alertData, 'Criar Alerta');
    } else {
      console.log(`${colors.yellow}⚠️  Nenhum paciente encontrado. Pulando testes que dependem de paciente.${colors.reset}`);
      console.log('');
    }
  } catch (error) {
    console.log(`${colors.yellow}⚠️  Erro ao obter pacientes: ${error.message}${colors.reset}`);
    console.log('');
  }

  // Teste 7: Listar mensagens
  await testEndpoint('GET', '/messages', null, 'Listar Mensagens');

  // Teste 8: Contar mensagens não assumidas
  await testEndpoint('GET', '/messages/unassumed/count', null, 'Contar Mensagens Não Assumidas');

  // Teste 9: Listar alertas
  await testEndpoint('GET', '/alerts', null, 'Listar Alertas');

  // Teste 10: Health check
  await testEndpoint('GET', '/health', null, 'Health Check');

  console.log('========================');
  console.log(`${colors.green}✅ Testes concluídos!${colors.reset}`);
}

// Executar testes
runTests().catch((error) => {
  console.error(`${colors.red}Erro fatal: ${error.message}${colors.reset}`);
  process.exit(1);
});

