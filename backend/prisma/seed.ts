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

  // Criar pacientes de teste - 1 paciente por tipo de câncer (estágios variados)
  // Tipos de câncer: breast, lung, colorectal, prostate, kidney, bladder, testicular
  // Total: 7 pacientes + 1 paliativo = 8 pacientes

  const patientDefs = [
    {
      type: 'breast',
      name: 'Ana Oliveira',
      gender: 'female' as const,
      stage: 'TREATMENT' as const,
      stageValue: 'IIA',
      priorityScore: 75,
      priorityCategory: 'HIGH' as const,
      status: 'IN_TREATMENT' as const,
      birthDate: new Date(1978, 3, 12),
    },
    {
      type: 'lung',
      name: 'Roberto Ferreira',
      gender: 'male' as const,
      stage: 'DIAGNOSIS' as const,
      stageValue: null,
      priorityScore: 65,
      priorityCategory: 'HIGH' as const,
      status: 'ACTIVE' as const,
      birthDate: new Date(1965, 8, 22),
    },
    {
      type: 'colorectal',
      name: 'Marcos Pereira',
      gender: 'male' as const,
      stage: 'TREATMENT' as const,
      stageValue: 'IIIA',
      priorityScore: 80,
      priorityCategory: 'CRITICAL' as const,
      status: 'IN_TREATMENT' as const,
      birthDate: new Date(1958, 1, 5),
    },
    {
      type: 'prostate',
      name: 'José Santos',
      gender: 'male' as const,
      stage: 'FOLLOW_UP' as const,
      stageValue: 'II',
      priorityScore: 30,
      priorityCategory: 'LOW' as const,
      status: 'FOLLOW_UP' as const,
      birthDate: new Date(1952, 11, 18),
    },
    {
      type: 'kidney',
      name: 'Paulo Mendes',
      gender: 'male' as const,
      stage: 'SCREENING' as const,
      stageValue: null,
      priorityScore: 20,
      priorityCategory: 'LOW' as const,
      status: 'ACTIVE' as const,
      birthDate: new Date(1970, 6, 30),
    },
    {
      type: 'bladder',
      name: 'Fernando Lima',
      gender: 'male' as const,
      stage: 'TREATMENT' as const,
      stageValue: 'III',
      priorityScore: 70,
      priorityCategory: 'HIGH' as const,
      status: 'IN_TREATMENT' as const,
      birthDate: new Date(1962, 4, 8),
    },
    {
      type: 'testicular',
      name: 'Lucas Almeida',
      gender: 'male' as const,
      stage: 'TREATMENT' as const,
      stageValue: 'I',
      priorityScore: 55,
      priorityCategory: 'MEDIUM' as const,
      status: 'IN_TREATMENT' as const,
      birthDate: new Date(1990, 9, 14),
    },
  ];

  const patients: Array<{
    id: string;
    cancerType: string;
    currentStage: string;
    name: string;
  }> = [];

  let phoneCounter = 9999999999;

  for (let i = 0; i < patientDefs.length; i++) {
    const def = patientDefs[i];
    const phone = `+5511${phoneCounter}`;
    const email = `paciente${i + 1}@email.com`;

    const patient = await prisma.patient.create({
      data: {
        tenantId: tenant.id,
        name: def.name,
        birthDate: def.birthDate,
        gender: def.gender,
        phone,
        email,
        cancerType: def.type,
        stage: def.stageValue,
        currentStage: def.stage,
        priorityScore: def.priorityScore,
        priorityCategory: def.priorityCategory,
        priorityReason: `Paciente em ${def.stage.toLowerCase()} - ${def.type}`,
        status: def.status,
      },
    });

    patients.push({
      id: patient.id,
      cancerType: def.type,
      currentStage: def.stage,
      name: patient.name,
    });

    phoneCounter--;
  }

  // Criar paciente em tratamento paliativo
  const palliativePatient = await prisma.patient.create({
    data: {
      tenantId: tenant.id,
      name: 'Antônio Ribeiro',
      birthDate: new Date(1955, 5, 15),
      gender: 'male',
      phone: `+5511${phoneCounter}`,
      email: `paciente.paliativo@email.com`,
      cancerType: 'lung',
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
    `✅ Pacientes criados: ${patients.length} (7 tipos de câncer + 1 paliativo)`,
  );
  for (const p of patients) {
    console.log(`  ${p.name} (${p.cancerType} - ${p.currentStage})`);
  }

  // Criar PatientJourney para cada paciente conforme seu estágio
  for (const patient of patients) {
    const journeyData: any = {
      tenantId: tenant.id,
      patientId: patient.id,
    };

    const isPalliative = patient.id === palliativePatient.id;

    if (isPalliative) {
      journeyData.screeningDate = new Date('2023-06-01');
      journeyData.screeningResult = `Rastreio positivo - ${patient.cancerType}`;
      journeyData.diagnosisDate = new Date('2023-07-15');
      journeyData.diagnosisConfirmed = true;
      journeyData.stagingDate = new Date('2023-08-01');
      journeyData.treatmentStartDate = new Date('2023-09-01');
      journeyData.treatmentType = 'CHEMOTHERAPY';
      journeyData.treatmentProtocol = `Protocolo inicial - ${patient.cancerType}`;
      journeyData.currentCycle = null;
      journeyData.totalCycles = null;
      journeyData.lastFollowUpDate = new Date('2024-11-01');
      journeyData.nextFollowUpDate = new Date('2024-12-15');
      journeyData.currentStep = 'Cuidados paliativos - controle de sintomas';
      journeyData.nextStep = 'Avaliação de qualidade de vida';
      journeyData.blockers = [];
    } else if (patient.currentStage === 'SCREENING') {
      journeyData.screeningDate = new Date('2024-12-01');
      journeyData.screeningResult = `Rastreio agendado - ${patient.cancerType}`;
    } else if (patient.currentStage === 'DIAGNOSIS') {
      journeyData.screeningDate = new Date('2024-11-15');
      journeyData.screeningResult = `Achado suspeito - ${patient.cancerType}`;
      journeyData.diagnosisDate = new Date('2024-11-25');
      journeyData.diagnosisConfirmed = true;
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

  // ─── Conversations e Mensagens ──────────────────────────────────────────────
  // Criar conversas realistas para vários pacientes

  let msgCounter = 1;
  const mkMsgId = () => `wamid.seed${String(msgCounter++).padStart(4, '0')}`;

  // Helper para criar conversa + mensagens
  async function createConversation(
    patientId: string,
    status: 'ACTIVE' | 'WAITING' | 'ESCALATED' | 'CLOSED',
    handledBy: 'AGENT' | 'NURSING' | 'HYBRID',
    msgs: Array<{
      direction: 'INBOUND' | 'OUTBOUND';
      content: string;
      processedBy: 'AGENT' | 'NURSING';
      minutesOffset: number;
      structuredData?: any;
      criticalSymptomsDetected?: string[];
      alertTriggered?: boolean;
    }>,
  ) {
    const baseTime = new Date('2024-12-10T09:00:00Z');
    const lastMsg = msgs[msgs.length - 1];
    const lastMsgTime = new Date(
      baseTime.getTime() + lastMsg.minutesOffset * 60000,
    );

    const conversation = await prisma.conversation.create({
      data: {
        tenantId: tenant.id,
        patientId,
        channel: 'WHATSAPP',
        status,
        handledBy,
        messageCount: msgs.length,
        lastMessageAt: lastMsgTime,
      },
    });

    for (const msg of msgs) {
      const timestamp = new Date(
        baseTime.getTime() + msg.minutesOffset * 60000,
      );
      await prisma.message.create({
        data: {
          tenantId: tenant.id,
          patientId,
          conversationId: conversation.id,
          whatsappMessageId: mkMsgId(),
          whatsappTimestamp: timestamp,
          type: 'TEXT',
          direction: msg.direction,
          content: msg.content,
          processedBy: msg.processedBy,
          structuredData: msg.structuredData || undefined,
          criticalSymptomsDetected: msg.criticalSymptomsDetected || [],
          alertTriggered: msg.alertTriggered || false,
        },
      });
    }

    return conversation;
  }

  // --- Conversa 1: Ana Oliveira (mama/treatment) - Náusea pós-quimio ---
  const anaPatient = patients.find((p) => p.name === 'Ana Oliveira');
  if (anaPatient) {
    await createConversation(anaPatient.id, 'ACTIVE', 'AGENT', [
      {
        direction: 'INBOUND',
        content: 'Olá, estou sentindo muita náusea hoje após a quimioterapia',
        processedBy: 'AGENT',
        minutesOffset: 0,
      },
      {
        direction: 'OUTBOUND',
        content:
          'Olá Ana! Entendo que você está sentindo náusea. Em uma escala de 0 a 10, como você classificaria a intensidade?',
        processedBy: 'AGENT',
        minutesOffset: 1,
      },
      {
        direction: 'INBOUND',
        content: 'Acho que uns 7, está bem forte',
        processedBy: 'AGENT',
        minutesOffset: 3,
      },
      {
        direction: 'OUTBOUND',
        content:
          'Entendo, uma intensidade 7 é significativa. Você está conseguindo se manter hidratada? E está tomando o antiemético que foi prescrito (ondansetrona)?',
        processedBy: 'AGENT',
        minutesOffset: 4,
        structuredData: {
          symptoms: { nausea: 7 },
          scales: { nausea: 7 },
        },
      },
      {
        direction: 'INBOUND',
        content:
          'Estou tentando tomar água mas é difícil. O remédio eu tomei de manhã sim',
        processedBy: 'AGENT',
        minutesOffset: 6,
      },
      {
        direction: 'OUTBOUND',
        content:
          'É importante manter a hidratação. Tente pequenos goles de água gelada ou chupe gelo. Se a náusea persistir acima de 7 nas próximas horas ou se você não conseguir manter líquidos, procure atendimento. Vou notificar a equipe de enfermagem sobre seu quadro.',
        processedBy: 'AGENT',
        minutesOffset: 7,
      },
    ]);
  }

  // --- Conversa 2: Marcos Pereira (colorectal/treatment) - Sintomas críticos ---
  const marcosPatient = patients.find((p) => p.name === 'Marcos Pereira');
  if (marcosPatient) {
    await createConversation(marcosPatient.id, 'ESCALATED', 'NURSING', [
      {
        direction: 'INBOUND',
        content: 'Boa tarde, estou com febre e muita dor abdominal',
        processedBy: 'AGENT',
        minutesOffset: 60,
      },
      {
        direction: 'OUTBOUND',
        content:
          'Boa tarde Marcos. Febre e dor abdominal durante tratamento de quimioterapia são sintomas que precisam de atenção. Qual sua temperatura? E a dor, de 0 a 10?',
        processedBy: 'AGENT',
        minutesOffset: 61,
      },
      {
        direction: 'INBOUND',
        content: 'Temperatura 38.5 e a dor tá uns 8',
        processedBy: 'AGENT',
        minutesOffset: 63,
      },
      {
        direction: 'OUTBOUND',
        content:
          'Marcos, febre de 38.5°C durante quimioterapia é um sinal de alerta importante que pode indicar neutropenia febril. Vou encaminhar seu caso imediatamente para a equipe de enfermagem. Por favor, NÃO tome medicamentos por conta própria e fique atento a qualquer piora.',
        processedBy: 'AGENT',
        minutesOffset: 64,
        structuredData: {
          symptoms: { febre: 8, dor_abdominal: 8 },
          scales: { pain: 8, fever: 38.5 },
        },
        criticalSymptomsDetected: ['febre neutropênica', 'dor abdominal'],
        alertTriggered: true,
      },
    ]);
  }

  // --- Conversa 3: Roberto Ferreira (lung/diagnosis) - Dúvidas sobre exames ---
  const robertoPatient = patients.find((p) => p.name === 'Roberto Ferreira');
  if (robertoPatient) {
    await createConversation(robertoPatient.id, 'ACTIVE', 'AGENT', [
      {
        direction: 'INBOUND',
        content:
          'Bom dia, tenho exame de tomografia marcado para semana que vem. Preciso de algum preparo?',
        processedBy: 'AGENT',
        minutesOffset: 120,
      },
      {
        direction: 'OUTBOUND',
        content:
          'Bom dia Roberto! Sim, para a tomografia com contraste você precisa: 1) Jejum de 4 horas antes do exame; 2) Trazer exames de creatinina recentes; 3) Informar se tem alergia a contraste iodado. Você tem alguma dessas condições?',
        processedBy: 'AGENT',
        minutesOffset: 121,
      },
      {
        direction: 'INBOUND',
        content:
          'Não tenho alergia não. Mas estou ansioso com o resultado, pode demorar muito?',
        processedBy: 'AGENT',
        minutesOffset: 124,
      },
      {
        direction: 'OUTBOUND',
        content:
          'Entendo sua ansiedade, é completamente normal nessa fase. O resultado geralmente fica pronto em 3 a 5 dias úteis. O Dr. João irá analisar as imagens e agendar uma consulta para discutir os resultados com você. Qualquer dúvida, estou aqui.',
        processedBy: 'AGENT',
        minutesOffset: 125,
      },
    ]);
  }

  // --- Conversa 4: José Santos (prostate/follow_up) - Acompanhamento ---
  const josePatient = patients.find((p) => p.name === 'José Santos');
  if (josePatient) {
    await createConversation(josePatient.id, 'ACTIVE', 'AGENT', [
      {
        direction: 'INBOUND',
        content: 'Olá, fiz o PSA semana passada e queria saber o resultado',
        processedBy: 'AGENT',
        minutesOffset: 180,
      },
      {
        direction: 'OUTBOUND',
        content:
          'Olá José! Verifiquei nos seus registros e o resultado do PSA ainda não foi inserido no sistema. Vou solicitar à equipe que verifique. Enquanto isso, como você está se sentindo? Algum sintoma novo?',
        processedBy: 'AGENT',
        minutesOffset: 181,
      },
      {
        direction: 'INBOUND',
        content:
          'Estou bem, sem sintomas novos. Só um pouco de cansaço mas acho que é da idade mesmo rs',
        processedBy: 'AGENT',
        minutesOffset: 184,
      },
    ]);
  }

  // --- Conversa 5: Fernando Lima (bladder/treatment) - Efeitos colaterais ---
  const fernandoPatient = patients.find((p) => p.name === 'Fernando Lima');
  if (fernandoPatient) {
    await createConversation(fernandoPatient.id, 'ACTIVE', 'AGENT', [
      {
        direction: 'INBOUND',
        content:
          'Estou com ardência para urinar e um pouco de sangue na urina. É normal?',
        processedBy: 'AGENT',
        minutesOffset: 240,
      },
      {
        direction: 'OUTBOUND',
        content:
          'Fernando, ardência ao urinar e hematúria (sangue na urina) podem ocorrer durante o tratamento de câncer de bexiga, mas precisamos avaliar. Desde quando começou? E a quantidade de sangue - é muito visível ou apenas um tom rosado?',
        processedBy: 'AGENT',
        minutesOffset: 241,
      },
      {
        direction: 'INBOUND',
        content:
          'Começou ontem. A urina tá meio rosada, não chega a ser vermelho forte',
        processedBy: 'AGENT',
        minutesOffset: 244,
      },
      {
        direction: 'OUTBOUND',
        content:
          'Entendi. Urina rosada pode ser um efeito esperado pós-tratamento, mas vamos monitorar. Mantenha boa hidratação (pelo menos 2 litros de água por dia). Se a cor ficar mais intensa, aparecer coágulos, ou surgir febre, entre em contato imediatamente. Vou registrar isso no seu prontuário.',
        processedBy: 'AGENT',
        minutesOffset: 245,
        structuredData: {
          symptoms: { disuria: 5, hematuria: 4 },
        },
      },
    ]);
  }

  // --- Conversa 6: Antônio Ribeiro (paliativo) - Controle de dor ---
  await createConversation(palliativePatient.id, 'WAITING', 'NURSING', [
    {
      direction: 'INBOUND',
      content:
        'Boa noite, a dor está muito forte hoje, o medicamento não está fazendo efeito',
      processedBy: 'AGENT',
      minutesOffset: 300,
    },
    {
      direction: 'OUTBOUND',
      content:
        'Boa noite Antônio. Sinto muito que a dor esteja forte. Em uma escala de 0 a 10, como está a dor agora? E onde é a dor principal?',
      processedBy: 'AGENT',
      minutesOffset: 301,
    },
    {
      direction: 'INBOUND',
      content: 'Dor 9, nas costas e no peito. Não consigo dormir',
      processedBy: 'AGENT',
      minutesOffset: 303,
    },
    {
      direction: 'OUTBOUND',
      content:
        'Antônio, dor 9/10 é muito intensa e precisa de ajuste na medicação. Vou encaminhar imediatamente para a equipe de enfermagem para ajuste do esquema analgésico. Enquanto isso, tente encontrar a posição mais confortável possível.',
      processedBy: 'AGENT',
      minutesOffset: 304,
      structuredData: {
        symptoms: { dor: 9, insonia: 8 },
        scales: { pain: 9, sleep: 8 },
      },
      criticalSymptomsDetected: ['dor intensa não controlada'],
      alertTriggered: true,
    },
    {
      direction: 'OUTBOUND',
      content:
        'Antônio, aqui é a enfermeira Maria. Já vi seu caso. Vou ligar para o Dr. João para ajustar sua medicação. Você tem alguém aí com você?',
      processedBy: 'NURSING',
      minutesOffset: 310,
    },
  ]);

  const totalMessages = msgCounter - 1;
  console.log(
    `✅ Conversas e mensagens criadas: 6 conversas, ${totalMessages} mensagens`,
  );

  // Criar alertas de exemplo
  if (marcosPatient) {
    await prisma.alert.create({
      data: {
        tenantId: tenant.id,
        patientId: marcosPatient.id,
        type: 'CRITICAL_SYMPTOM',
        severity: 'CRITICAL',
        message:
          'Paciente reportou febre de 38.5°C e dor abdominal intensa durante quimioterapia',
        context: {
          symptoms: ['febre neutropênica', 'dor abdominal'],
          temperature: 38.5,
        },
        status: 'PENDING',
      },
    });
    console.log('✅ Alerta crítico criado para Marcos Pereira');
  }

  if (palliativePatient) {
    await prisma.alert.create({
      data: {
        tenantId: tenant.id,
        patientId: palliativePatient.id,
        type: 'CRITICAL_SYMPTOM',
        severity: 'HIGH',
        message:
          'Dor não controlada (9/10) em paciente paliativo - necessita ajuste analgésico',
        context: {
          symptoms: ['dor intensa não controlada'],
          painLevel: 9,
        },
        status: 'PENDING',
      },
    });
    console.log('✅ Alerta de dor criado para Antônio Ribeiro');
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
