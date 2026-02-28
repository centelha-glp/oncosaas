import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Carregar variáveis de ambiente do arquivo .env na raiz do projeto
dotenv.config({ path: resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Criar Tenant de teste
  const tenant = await prisma.tenant.upsert({
    where: { schemaName: 'hospital_teste' },
    update: {},
    create: {
      name: 'Hospital de Teste',
      schemaName: 'hospital_teste',
      settings: {
        timezone: 'America/Sao_Paulo',
        language: 'pt-BR',
      },
    },
  });

  console.log('✅ Tenant criado:', tenant.name);

  // Criar usuários de teste
  const hashedPassword = await bcrypt.hash('senha123', 10);

  const admin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'admin@hospitalteste.com',
      },
    },
    update: {},
    create: {
      email: 'admin@hospitalteste.com',
      password: hashedPassword,
      name: 'Administrador',
      role: 'ADMIN',
      tenantId: tenant.id,
    },
  });

  const oncologist = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'oncologista@hospitalteste.com',
      },
    },
    update: {},
    create: {
      email: 'oncologista@hospitalteste.com',
      password: hashedPassword,
      name: 'Dr. João Silva',
      role: 'ONCOLOGIST',
      tenantId: tenant.id,
    },
  });

  const nurse = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'enfermeira@hospitalteste.com',
      },
    },
    update: {},
    create: {
      email: 'enfermeira@hospitalteste.com',
      password: hashedPassword,
      name: 'Maria Santos',
      role: 'NURSE',
      tenantId: tenant.id,
    },
  });

  const coordinator = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'coordenador@hospitalteste.com',
      },
    },
    update: {},
    create: {
      email: 'coordenador@hospitalteste.com',
      password: hashedPassword,
      name: 'Carlos Oliveira',
      role: 'COORDINATOR',
      tenantId: tenant.id,
    },
  });

  console.log('✅ Usuários criados:');
  console.log('  - Admin:', admin.email);
  console.log('  - Oncologista:', oncologist.email);
  console.log('  - Enfermeira:', nurse.email);
  console.log('  - Coordenador:', coordinator.email);

  // Limpar pacientes existentes antes de criar novos
  console.log('🧹 Limpando pacientes existentes...');
  await prisma.patient.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log('✅ Pacientes anteriores removidos');

  // Criar pacientes de teste - 4 pacientes em cada tipo de câncer (1 em cada estágio)
  // Tipos de câncer: breast, lung, colorectal, prostate, kidney, bladder, testicular
  // Estágios: SCREENING, DIAGNOSIS, TREATMENT, FOLLOW_UP
  // Total: 7 tipos × 4 estágios = 28 pacientes

  const cancerTypes = [
    { type: 'breast', name: 'Mama', gender: 'female' as const },
    { type: 'lung', name: 'Pulmão', gender: 'male' as const },
    { type: 'colorectal', name: 'Colorretal', gender: 'male' as const },
    { type: 'prostate', name: 'Próstata', gender: 'male' as const },
    { type: 'kidney', name: 'Rim', gender: 'male' as const },
    { type: 'bladder', name: 'Bexiga', gender: 'male' as const },
    { type: 'testicular', name: 'Testículo', gender: 'male' as const },
  ];

  const journeyStages = [
    {
      stage: 'SCREENING' as const,
      name: 'Rastreio',
      priorityScore: 20,
      priorityCategory: 'LOW' as const,
      status: 'ACTIVE' as const,
      stageValue: null,
    },
    {
      stage: 'DIAGNOSIS' as const,
      name: 'Diagnóstico',
      priorityScore: 65,
      priorityCategory: 'HIGH' as const,
      status: 'ACTIVE' as const,
      stageValue: null,
    },
    {
      stage: 'TREATMENT' as const,
      name: 'Tratamento',
      priorityScore: 75,
      priorityCategory: 'HIGH' as const,
      status: 'IN_TREATMENT' as const,
      stageValue: 'IIIA',
    },
    {
      stage: 'FOLLOW_UP' as const,
      name: 'Seguimento',
      priorityScore: 30,
      priorityCategory: 'LOW' as const,
      status: 'FOLLOW_UP' as const,
      stageValue: 'II',
    },
  ];

  const patients: Array<{
    id: string;
    cancerType: string;
    currentStage: string;
    name: string;
  }> = [];

  let patientCounter = 1;
  let phoneCounter = 9999999999;
  let emailCounter = 1;

  for (const cancer of cancerTypes) {
    for (const journeyStage of journeyStages) {
      const name = `${cancer.name} - ${journeyStage.name}`;
      const phone = `+5511${phoneCounter}`;
      const email = `paciente${emailCounter}@email.com`;

      const patient = await prisma.patient.create({
        data: {
          tenantId: tenant.id,
          name,
          birthDate: new Date(
            1970 + patientCounter,
            patientCounter % 12,
            (patientCounter % 28) + 1
          ),
          gender: cancer.gender,
          phone,
          email,
          cancerType: cancer.type,
          stage: journeyStage.stageValue,
          currentStage: journeyStage.stage,
          priorityScore: journeyStage.priorityScore,
          priorityCategory: journeyStage.priorityCategory,
          priorityReason: `Paciente em ${journeyStage.name.toLowerCase()} - ${cancer.name}`,
          status: journeyStage.status,
        },
      });

      patients.push({
        id: patient.id,
        cancerType: cancer.type,
        currentStage: journeyStage.stage,
        name: patient.name,
      });

      patientCounter++;
      phoneCounter--;
      emailCounter++;
    }
  }

  // Criar paciente em tratamento paliativo
  const palliativePatient = await prisma.patient.create({
    data: {
      tenantId: tenant.id,
      name: 'Paciente Paliativo - Cuidados Paliativos',
      birthDate: new Date(1955, 5, 15),
      gender: 'male',
      phone: `+5511999999999`,
      email: `paciente.paliativo@email.com`,
      cancerType: 'lung', // Tipo de câncer original
      stage: 'IV',
      currentStage: 'FOLLOW_UP',
      priorityScore: 85,
      priorityCategory: 'HIGH',
      priorityReason:
        'Paciente em tratamento paliativo - necessita acompanhamento contínuo',
      status: 'PALLIATIVE_CARE',
      ehrPatientId: null,
      lastSyncAt: null,
      lastInteraction: new Date(),
    },
  });

  patients.push({
    id: palliativePatient.id,
    cancerType: 'lung',
    currentStage: 'FOLLOW_UP',
    name: palliativePatient.name,
  });

  console.log(
    `✅ Pacientes criados: ${patients.length} (${cancerTypes.length} tipos × ${journeyStages.length} estágios + 1 paciente paliativo)`
  );
  console.log('📊 Distribuição por tipo de câncer:');
  for (const cancer of cancerTypes) {
    const cancerPatients = patients.filter((p) => p.cancerType === cancer.type);
    console.log(
      `  ${cancer.name}: ${cancerPatients.length} pacientes (${cancerPatients.map((p) => p.currentStage).join(', ')})`
    );
  }
  console.log(`  💜 Tratamento Paliativo: 1 paciente`);

  // Criar PatientJourney para cada paciente conforme seu estágio
  for (const patient of patients) {
    const journeyData: any = {
      tenantId: tenant.id,
      patientId: patient.id,
    };

    // Verificar se é paciente paliativo
    const isPalliative = patient.id === palliativePatient.id;

    if (isPalliative) {
      // PatientJourney para paciente paliativo
      journeyData.screeningDate = new Date('2023-06-01');
      journeyData.screeningResult = `Rastreio positivo - ${patient.cancerType}`;
      journeyData.diagnosisDate = new Date('2023-07-15');
      journeyData.diagnosisConfirmed = true;
      journeyData.stagingDate = new Date('2023-08-01');
      journeyData.treatmentStartDate = new Date('2023-09-01');
      journeyData.treatmentType = 'CHEMOTHERAPY';
      journeyData.treatmentProtocol = `Protocolo inicial - ${patient.cancerType}`;
      journeyData.currentCycle = null; // Tratamento paliativo
      journeyData.totalCycles = null;
      journeyData.lastFollowUpDate = new Date('2024-11-01');
      journeyData.nextFollowUpDate = new Date('2024-12-15');
      journeyData.currentStep = 'Cuidados paliativos - controle de sintomas';
      journeyData.nextStep = 'Avaliação de qualidade de vida';
      journeyData.blockers = [];
    } else if (patient.currentStage === 'SCREENING') {
      journeyData.screeningDate = new Date('2024-12-01');
      journeyData.screeningResult = `Rastreio agendado - ${patient.cancerType}`;
      journeyData.diagnosisDate = null;
      journeyData.diagnosisConfirmed = false;
      journeyData.stagingDate = null;
      journeyData.treatmentStartDate = null;
      journeyData.treatmentType = null;
      journeyData.treatmentProtocol = null;
      journeyData.currentCycle = null;
      journeyData.totalCycles = null;
      journeyData.nextFollowUpDate = null;
    } else if (patient.currentStage === 'DIAGNOSIS') {
      journeyData.screeningDate = new Date('2024-11-15');
      journeyData.screeningResult = `Achado suspeito detectado - ${patient.cancerType}`;
      journeyData.diagnosisDate = new Date('2024-11-25');
      journeyData.diagnosisConfirmed = true;
      journeyData.stagingDate = null; // Estadiamento em andamento
      journeyData.treatmentStartDate = null;
      journeyData.treatmentType = null;
      journeyData.treatmentProtocol = null;
      journeyData.currentCycle = null;
      journeyData.totalCycles = null;
      journeyData.nextFollowUpDate = null;
    } else if (patient.currentStage === 'TREATMENT') {
      journeyData.screeningDate = new Date('2024-01-15');
      journeyData.screeningResult = `Rastreio positivo - ${patient.cancerType}`;
      journeyData.diagnosisDate = new Date('2024-02-01');
      journeyData.diagnosisConfirmed = true;
      journeyData.stagingDate = new Date('2024-02-10');
      journeyData.treatmentStartDate = new Date('2024-03-01');
      journeyData.treatmentType = 'CHEMOTHERAPY';
      journeyData.treatmentProtocol = `Protocolo padrão - ${patient.cancerType}`;
      journeyData.currentCycle = 3;
      journeyData.totalCycles = 8;
      journeyData.nextFollowUpDate = new Date('2024-12-20');
    } else if (patient.currentStage === 'FOLLOW_UP') {
      journeyData.screeningDate = new Date('2023-06-10');
      journeyData.screeningResult = `Rastreio inicial - ${patient.cancerType}`;
      journeyData.diagnosisDate = new Date('2023-07-05');
      journeyData.diagnosisConfirmed = true;
      journeyData.stagingDate = new Date('2023-07-15');
      journeyData.treatmentStartDate = new Date('2023-08-01');
      journeyData.treatmentType = 'SURGERY';
      journeyData.treatmentProtocol = `Tratamento cirúrgico - ${patient.cancerType}`;
      journeyData.currentCycle = null;
      journeyData.totalCycles = null;
      journeyData.lastFollowUpDate = new Date('2023-09-15');
      journeyData.nextFollowUpDate = new Date('2024-12-20');
    }

    await prisma.patientJourney.upsert({
      where: { patientId: patient.id },
      update: {},
      create: journeyData,
    });
  }

  console.log(`✅ PatientJourney criado para ${patients.length} pacientes`);

  // Criar algumas mensagens de exemplo (usar upsert para evitar duplicatas)
  // Pegar um paciente em tratamento para criar mensagens de exemplo
  const treatmentPatient = patients.find((p) => p.currentStage === 'TREATMENT');
  if (treatmentPatient) {
    const message1 = await prisma.message.upsert({
      where: { whatsappMessageId: 'wamid.test001' },
      update: {},
      create: {
        tenantId: tenant.id,
        patientId: treatmentPatient.id,
        whatsappMessageId: 'wamid.test001',
        whatsappTimestamp: new Date('2024-12-10T10:00:00Z'),
        type: 'TEXT',
        direction: 'INBOUND',
        content: 'Olá, estou sentindo muita náusea hoje após a quimioterapia',
        processedBy: 'AGENT',
        criticalSymptomsDetected: [],
        alertTriggered: false,
      },
    });

    const message2 = await prisma.message.upsert({
      where: { whatsappMessageId: 'wamid.test002' },
      update: {},
      create: {
        tenantId: tenant.id,
        patientId: treatmentPatient.id,
        conversationId: message1.id,
        whatsappMessageId: 'wamid.test002',
        whatsappTimestamp: new Date('2024-12-10T10:05:00Z'),
        type: 'TEXT',
        direction: 'OUTBOUND',
        content:
          'Entendo que você está sentindo náusea. Em uma escala de 0 a 10, como você classificaria a intensidade?',
        processedBy: 'AGENT',
      },
    });

    console.log('✅ Mensagens de exemplo criadas:', 2);
  }

  // Criar alerta de exemplo (verificar se já existe)
  // Pegar um paciente em diagnóstico para criar alerta
  const diagnosisPatient = patients.find((p) => p.currentStage === 'DIAGNOSIS');
  if (diagnosisPatient) {
    const existingAlert = await prisma.alert.findFirst({
      where: {
        tenantId: tenant.id,
        patientId: diagnosisPatient.id,
        type: 'CRITICAL_SYMPTOM',
      },
    });

    if (!existingAlert) {
      await prisma.alert.create({
        data: {
          tenantId: tenant.id,
          patientId: diagnosisPatient.id,
          type: 'CRITICAL_SYMPTOM',
          severity: 'CRITICAL',
          message: 'Paciente reportou febre acima de 38°C e falta de ar',
          context: {
            conversationId: 'conv_001',
            symptoms: ['febre', 'dispneia'],
            temperature: 38.5,
          },
          status: 'PENDING',
        },
      });
      console.log('✅ Alerta crítico criado');
    } else {
      console.log('✅ Alerta crítico já existe');
    }
  }

  // ─── AgentConfig ────────────────────────────────────────────────────────────
  const existingAgentConfig = await prisma.agentConfig.findUnique({
    where: { tenantId: tenant.id },
  });
  if (!existingAgentConfig) {
    await prisma.agentConfig.create({
      data: {
        tenantId: tenant.id,
        llmProvider: 'anthropic',
        llmModel: 'claude-sonnet-4-6',
        llmFallbackProvider: 'openai',
        llmFallbackModel: 'gpt-4o-mini',
        maxAutoReplies: 10,
        agentLanguage: 'pt-BR',
        escalationRules: {
          threshold: 'HIGH',
          workingHoursStart: '08:00',
          workingHoursEnd: '20:00',
        },
        defaultCheckInFrequency: { TREATMENT: 'daily', FOLLOW_UP: 'weekly' },
        riskBasedAdjustment: true,
      },
    });
    console.log('✅ AgentConfig criado para o tenant');
  } else {
    console.log('✅ AgentConfig já existe');
  }

  // ─── ClinicalProtocols ───────────────────────────────────────────────────────
  const protocolTypes = ['colorectal', 'bladder', 'renal', 'prostate'];
  for (const cancerType of protocolTypes) {
    const existing = await prisma.clinicalProtocol.findFirst({
      where: { tenantId: tenant.id, cancerType },
    });
    if (!existing) {
      await prisma.clinicalProtocol.create({
        data: {
          tenantId: tenant.id,
          name: `Protocolo ${cancerType.charAt(0).toUpperCase() + cancerType.slice(1)}`,
          cancerType,
          version: '1.0',
          isActive: true,
          definition: {
            stages: ['SCREENING', 'DIAGNOSIS', 'TREATMENT', 'FOLLOW_UP'],
          },
          checkInRules: {
            SCREENING: { frequency: 'weekly', questionnaire: null },
            DIAGNOSIS: { frequency: 'twice_weekly', questionnaire: null },
            TREATMENT: { frequency: 'daily', questionnaire: 'ESAS' },
            FOLLOW_UP: { frequency: 'weekly', questionnaire: 'PRO_CTCAE' },
          },
          criticalSymptoms: {
            TREATMENT: [
              'febre neutropênica',
              'falta de ar',
              'sangramento',
              'obstrução intestinal',
            ],
          },
        },
      });
      console.log(`✅ Protocolo ${cancerType} criado`);
    } else {
      console.log(`✅ Protocolo ${cancerType} já existe`);
    }
  }

  // ─── ESAS Questionnaire template ─────────────────────────────────────────────
  const esasExists = await prisma.questionnaire.findFirst({
    where: { tenantId: tenant.id, type: 'ESAS' },
  });
  if (!esasExists) {
    await prisma.questionnaire.create({
      data: {
        tenantId: tenant.id,
        code: 'ESAS',
        name: 'ESAS — Edmonton Symptom Assessment System',
        type: 'ESAS',
        isActive: true,
        structure: {
          items: [
            { key: 'pain', label: 'Dor', scale: '0-10' },
            { key: 'fatigue', label: 'Cansaço', scale: '0-10' },
            { key: 'nausea', label: 'Náusea', scale: '0-10' },
            { key: 'depression', label: 'Humor/Depressão', scale: '0-10' },
            { key: 'anxiety', label: 'Ansiedade', scale: '0-10' },
            { key: 'drowsiness', label: 'Sonolência', scale: '0-10' },
            { key: 'appetite', label: 'Apetite', scale: '0-10' },
            { key: 'wellbeing', label: 'Bem-estar geral', scale: '0-10' },
            { key: 'dyspnea', label: 'Falta de ar', scale: '0-10' },
          ],
          alertThreshold: 7,
          totalAlertThreshold: 50,
        },
      },
    });
    console.log('✅ Questionário ESAS criado');
  } else {
    console.log('✅ Questionário ESAS já existe');
  }

  // ─── PRO-CTCAE Questionnaire template ────────────────────────────────────────
  const proCtcaeExists = await prisma.questionnaire.findFirst({
    where: { tenantId: tenant.id, type: 'PRO_CTCAE' },
  });
  if (!proCtcaeExists) {
    await prisma.questionnaire.create({
      data: {
        tenantId: tenant.id,
        code: 'PRO_CTCAE',
        name: 'PRO-CTCAE — Patient-Reported Outcomes CTCAE',
        type: 'PRO_CTCAE',
        isActive: true,
        structure: {
          items: [
            { key: 'pain', attributes: ['severity', 'interference'] },
            { key: 'fatigue', attributes: ['severity', 'interference'] },
            { key: 'nausea', attributes: ['frequency', 'severity'] },
            { key: 'diarrhea', attributes: ['frequency', 'severity'] },
            { key: 'constipation', attributes: ['severity'] },
            { key: 'appetite_loss', attributes: ['severity', 'interference'] },
            { key: 'dyspnea', attributes: ['severity', 'interference'] },
            { key: 'insomnia', attributes: ['frequency', 'severity'] },
            { key: 'neuropathy', attributes: ['severity', 'interference'] },
            { key: 'mucositis', attributes: ['severity', 'interference'] },
          ],
          alertGrade: 3,
        },
      },
    });
    console.log('✅ Questionário PRO-CTCAE criado');
  } else {
    console.log('✅ Questionário PRO-CTCAE já existe');
  }

  console.log('');
  console.log('🎉 Seed concluído com sucesso!');
  console.log('');
  console.log('📋 Credenciais de teste:');
  console.log('  Email: admin@hospitalteste.com');
  console.log('  Senha: senha123');
  console.log('');
  console.log('  Email: enfermeira@hospitalteste.com');
  console.log('  Senha: senha123');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao executar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
