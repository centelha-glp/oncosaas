import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from '@generated/prisma/client';
import * as bcrypt from 'bcrypt';
import { EXAM_CATALOG_SEED_ROWS } from './exam-catalog-seed-data';

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

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
        enabledCancerTypes: ['bladder'], // MVP: apenas câncer de bexiga
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
  // Guias TISS primeiro: itens referenciam clinical_exam_requests com onDelete Restrict —
  // cascata ao apagar paciente pode falhar (P2003) se os guias ainda existirem.
  console.log('🧹 Removendo guias TISS SP/SADT do tenant...');
  await prisma.tissSpsadtGuide.deleteMany({
    where: { tenantId: tenant.id },
  });
  // scheduled_actions tem patientId sem FK no schema — não cascata ao apagar paciente.
  console.log('🧹 Removendo scheduled_actions órfãos do tenant...');
  await prisma.scheduledAction.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log('🧹 Limpando pacientes existentes...');
  await prisma.patient.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log('✅ Pacientes anteriores removidos');

  // ─── Pacientes de bexiga — piloto clínico ───────────────────────────────────
  // 10 pacientes com câncer de bexiga distribuídos nas 4 fases da jornada:
  //   2 × SCREENING, 2 × DIAGNOSIS, 4 × TREATMENT, 2 × FOLLOW_UP
  // TNM variados, ECOG 0-3, idades 45-75, comorbidades e medicamentos reais.

  type PatientRecord = { id: string; name: string; currentStage: string };
  const patients: PatientRecord[] = [];

  let phoneCounter = 9999999990;
  let emailCounter = 1;
  const mkPhone = () => `+5511${phoneCounter--}`;
  const mkEmail = () => `paciente.bexiga${emailCounter++}@email.com`;

  // ── SCREENING 1: Suspeita hematúria, aguardando cistoscopia ─────────────────
  {
    const p = await prisma.patient.create({
      data: {
        tenantId: tenant.id,
        name: 'Carlos Eduardo Martins',
        birthDate: new Date(1958, 2, 14), // 67 anos
        gender: 'male',
        phone: mkPhone(),
        email: mkEmail(),
        cancerType: 'bladder',
        stage: null,
        currentStage: 'SCREENING',
        performanceStatus: 1, // ECOG 1
        priorityScore: 25,
        priorityCategory: 'LOW',
        priorityReason: 'Rastreio inicial — hematúria assintomática, cistoscopia agendada',
        status: 'ACTIVE',
      },
    });
    patients.push({ id: p.id, name: p.name, currentStage: 'SCREENING' });

    await prisma.patientJourney.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        screeningDate: new Date('2026-03-20'),
        screeningResult: 'Hematúria microscópica detectada em exame de urina de rotina. Citologia solicitada.',
        currentStep: 'Aguardando cistoscopia',
        nextStep: 'Cistoscopia — encaminhamento para urologista',
        blockers: ['Aguardando agendamento cistoscopia via convênio'],
      },
    });

    await prisma.comorbidity.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        name: 'Hipertensão Arterial Sistêmica',
        type: 'HYPERTENSION',
        severity: 'MILD',
        controlled: true,
        increasesSepsisRisk: false,
        notes: 'Controlada com losartana 50 mg/dia',
      },
    });
    await prisma.medication.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        name: 'Losartana',
        dosage: '50 mg',
        frequency: '1x/dia',
        indication: 'HAS',
        route: 'VO',
        category: 'ANTIHYPERTENSIVE',
        isActive: true,
      },
    });

    await prisma.performanceStatusHistory.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        ecogScore: 1,
        assessedAt: new Date('2026-03-20'),
        source: 'MANUAL',
        notes: 'Avaliação inicial na admissão ao programa de navegação',
      },
    });
  }

  // ── SCREENING 2: Exame preventivo, idoso com fatores de risco ───────────────
  {
    const p = await prisma.patient.create({
      data: {
        tenantId: tenant.id,
        name: 'Hélio Augusto Nogueira',
        birthDate: new Date(1951, 8, 3), // 74 anos
        gender: 'male',
        phone: mkPhone(),
        email: mkEmail(),
        cancerType: 'bladder',
        stage: null,
        currentStage: 'SCREENING',
        performanceStatus: 1,
        priorityScore: 30,
        priorityCategory: 'LOW',
        priorityReason: 'Rastreio preventivo — tabagismo pesado (40 anos-maço), sintomas urinários',
        status: 'ACTIVE',
        smokingProfile: { status: 'former', packYears: 40, quitYear: 2018, notes: 'Ex-tabagista pesado' },
      },
    });
    patients.push({ id: p.id, name: p.name, currentStage: 'SCREENING' });

    await prisma.patientJourney.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        screeningDate: new Date('2026-03-28'),
        screeningResult: 'Disúria e urgência miccional há 3 meses. Uroculturas negativas. Citologia em análise.',
        currentStep: 'Citologia urinária em andamento',
        nextStep: 'Revisão de resultado da citologia + decisão sobre cistoscopia',
        blockers: [],
      },
    });

    await prisma.comorbidity.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        name: 'Doença Pulmonar Obstrutiva Crônica',
        type: 'COPD',
        severity: 'MODERATE',
        controlled: true,
        affectsPulmonaryReserve: true,
        notes: 'DPOC grau II GOLD. Em uso de broncodilatador.',
      },
    });
    await prisma.comorbidity.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        name: 'Hipertensão Arterial Sistêmica',
        type: 'HYPERTENSION',
        severity: 'MILD',
        controlled: true,
      },
    });
    await prisma.medication.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        name: 'Tiotropio',
        dosage: '18 mcg',
        frequency: '1x/dia',
        indication: 'DPOC',
        route: 'Inalatória',
        category: 'OTHER',
        isActive: true,
      },
    });

    await prisma.performanceStatusHistory.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        ecogScore: 1,
        assessedAt: new Date('2026-03-28'),
        source: 'MANUAL',
      },
    });
  }

  // ── DIAGNOSIS 1: Cistoscopia realizada, aguardando TURBT ────────────────────
  {
    const p = await prisma.patient.create({
      data: {
        tenantId: tenant.id,
        name: 'Renata Sousa Lima',
        birthDate: new Date(1971, 6, 22), // 54 anos, única mulher do piloto
        gender: 'female',
        phone: mkPhone(),
        email: mkEmail(),
        cancerType: 'bladder',
        stage: 'Ta',
        currentStage: 'DIAGNOSIS',
        performanceStatus: 0, // ECOG 0 — totalmente funcional
        priorityScore: 45,
        priorityCategory: 'MEDIUM',
        priorityReason: 'TURBT pendente — lesão papilar superficial Ta visualizada em cistoscopia',
        status: 'ACTIVE',
      },
    });
    patients.push({ id: p.id, name: p.name, currentStage: 'DIAGNOSIS' });

    const diag = await prisma.cancerDiagnosis.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        cancerType: 'bladder',
        icd10Code: 'C67.9',
        tStage: 'Ta',
        nStage: 'N0',
        mStage: 'M0',
        stage: 'TaN0M0',
        histologicalType: 'carcinoma urotelial papilar',
        diagnosisDate: new Date('2026-03-15'),
        diagnosisConfirmed: false, // aguarda confirmação anatomopatológica pós-TURBT
        pathologyReport: 'Cistoscopia: lesão papilar séssil de 1,2 cm na parede lateral esquerda. Biópsia superficial coletada.',
        stagingDate: new Date('2026-03-15'),
        isPrimary: true,
        isActive: true,
      },
    });

    await prisma.patientJourney.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        screeningDate: new Date('2026-02-10'),
        screeningResult: 'Hematúria macroscópica intermitente. Encaminhada para cistoscopia.',
        diagnosisDate: new Date('2026-03-15'),
        diagnosisConfirmed: false,
        stagingDate: new Date('2026-03-15'),
        currentStep: 'TURBT diagnóstica agendada',
        nextStep: 'Laudo anatomopatológico pós-TURBT → decisão de tratamento',
        blockers: ['Aguardando centro cirúrgico disponível'],
      },
    });

    await prisma.navigationStep.createMany({
      data: [
        {
          tenantId: tenant.id,
          patientId: p.id,
          diagnosisId: diag.id,
          cancerType: 'bladder',
          journeyStage: 'DIAGNOSIS',
          stepKey: 'cystoscopy',
          stepName: 'Cistoscopia',
          status: 'COMPLETED',
          isRequired: true,
          isCompleted: true,
          completedAt: new Date('2026-03-15'),
          actualDate: new Date('2026-03-15'),
          result: 'Lesão papilar Ta na parede lateral esquerda',
          stepOrder: 1,
        },
        {
          tenantId: tenant.id,
          patientId: p.id,
          diagnosisId: diag.id,
          cancerType: 'bladder',
          journeyStage: 'DIAGNOSIS',
          stepKey: 'turbt',
          stepName: 'RTU de Bexiga (TURBT)',
          status: 'PENDING',
          isRequired: true,
          isCompleted: false,
          expectedDate: new Date('2026-04-20'),
          dueDate: new Date('2026-05-05'),
          stepOrder: 2,
        },
        {
          tenantId: tenant.id,
          patientId: p.id,
          diagnosisId: diag.id,
          cancerType: 'bladder',
          journeyStage: 'DIAGNOSIS',
          stepKey: 'staging_ct',
          stepName: 'TC Abdome/Pelve',
          status: 'PENDING',
          isRequired: true,
          isCompleted: false,
          expectedDate: new Date('2026-04-10'),
          stepOrder: 3,
        },
      ],
    });

    await prisma.performanceStatusHistory.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        ecogScore: 0,
        assessedAt: new Date('2026-03-15'),
        source: 'MANUAL',
      },
    });
  }

  // ── DIAGNOSIS 2: Estadiamento em andamento — tumor músculo-invasivo suspeito ─
  {
    const p = await prisma.patient.create({
      data: {
        tenantId: tenant.id,
        name: 'Antônio Carlos Barbosa',
        birthDate: new Date(1955, 11, 8), // 70 anos
        gender: 'male',
        phone: mkPhone(),
        email: mkEmail(),
        cancerType: 'bladder',
        stage: 'T2',
        currentStage: 'DIAGNOSIS',
        performanceStatus: 1,
        priorityScore: 60,
        priorityCategory: 'HIGH',
        priorityReason: 'Tumor músculo-invasivo (T2) confirmado — estadiamento sistêmico em andamento',
        status: 'ACTIVE',
      },
    });
    patients.push({ id: p.id, name: p.name, currentStage: 'DIAGNOSIS' });

    const diag = await prisma.cancerDiagnosis.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        cancerType: 'bladder',
        icd10Code: 'C67.9',
        tStage: 'T2',
        nStage: 'N0',
        mStage: 'M0',
        stage: 'T2N0M0 — estadiamento completo pendente',
        grade: 'G3',
        histologicalType: 'carcinoma urotelial de alto grau',
        diagnosisDate: new Date('2026-03-10'),
        diagnosisConfirmed: true,
        pathologyReport: 'TURBT: carcinoma urotelial de alto grau infiltrando muscular própria (T2). Ki-67 > 70%.',
        stagingDate: new Date('2026-03-12'),
        isPrimary: true,
        isActive: true,
      },
    });

    await prisma.patientJourney.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        screeningDate: new Date('2026-01-15'),
        screeningResult: 'Hematúria macroscópica persistente com coágulos.',
        diagnosisDate: new Date('2026-03-10'),
        diagnosisConfirmed: true,
        stagingDate: new Date('2026-03-12'),
        currentStep: 'TC abdome/pelve + PET-CT em andamento para estadiamento sistêmico',
        nextStep: 'Discussão multidisciplinar pós-estadiamento',
        blockers: ['Aguardando resultado de TC — marcado para 05/04'],
      },
    });

    await prisma.navigationStep.createMany({
      data: [
        {
          tenantId: tenant.id,
          patientId: p.id,
          diagnosisId: diag.id,
          cancerType: 'bladder',
          journeyStage: 'DIAGNOSIS',
          stepKey: 'cystoscopy',
          stepName: 'Cistoscopia',
          status: 'COMPLETED',
          isRequired: true,
          isCompleted: true,
          completedAt: new Date('2026-03-05'),
          result: 'Tumor sessil de 3 cm em parede posterior — músculo-invasivo',
          stepOrder: 1,
        },
        {
          tenantId: tenant.id,
          patientId: p.id,
          diagnosisId: diag.id,
          cancerType: 'bladder',
          journeyStage: 'DIAGNOSIS',
          stepKey: 'turbt',
          stepName: 'RTU de Bexiga (TURBT)',
          status: 'COMPLETED',
          isRequired: true,
          isCompleted: true,
          completedAt: new Date('2026-03-10'),
          result: 'Carcinoma urotelial alto grau T2',
          stepOrder: 2,
        },
        {
          tenantId: tenant.id,
          patientId: p.id,
          diagnosisId: diag.id,
          cancerType: 'bladder',
          journeyStage: 'DIAGNOSIS',
          stepKey: 'staging_ct',
          stepName: 'TC Abdome/Pelve',
          status: 'IN_PROGRESS',
          isRequired: true,
          isCompleted: false,
          expectedDate: new Date('2026-04-05'),
          stepOrder: 3,
        },
      ],
    });

    await prisma.comorbidity.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        name: 'Diabetes Mellitus tipo 2',
        type: 'DIABETES_TYPE_2',
        severity: 'MODERATE',
        controlled: true,
        increasesSepsisRisk: true,
        notes: 'DM2 há 12 anos. HbA1c atual: 7.2%.',
      },
    });
    await prisma.comorbidity.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        name: 'Hipertensão Arterial Sistêmica',
        type: 'HYPERTENSION',
        severity: 'MODERATE',
        controlled: true,
      },
    });

    await prisma.medication.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        name: 'Metformina',
        dosage: '850 mg',
        frequency: '2x/dia',
        indication: 'DM2',
        route: 'VO',
        category: 'ANTIDIABETIC',
        isActive: true,
      },
    });
    await prisma.medication.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        name: 'Enalapril',
        dosage: '10 mg',
        frequency: '1x/dia',
        indication: 'HAS',
        route: 'VO',
        category: 'ANTIHYPERTENSIVE',
        isActive: true,
      },
    });

    await prisma.performanceStatusHistory.createMany({
      data: [
        {
          tenantId: tenant.id,
          patientId: p.id,
          ecogScore: 0,
          assessedAt: new Date('2026-01-15'),
          source: 'MANUAL',
          notes: 'ECOG na admissão',
        },
        {
          tenantId: tenant.id,
          patientId: p.id,
          ecogScore: 1,
          assessedAt: new Date('2026-03-12'),
          source: 'MANUAL',
          notes: 'Piora discreta após TURBT — sintomas urinários',
        },
      ],
    });
  }

  // ── TREATMENT 1: BCG intravesical — NMIBC Ta/T1, 3º ciclo ───────────────────
  {
    const p = await prisma.patient.create({
      data: {
        tenantId: tenant.id,
        name: 'Fernando Augusto Lima',
        birthDate: new Date(1962, 4, 8), // 63 anos
        gender: 'male',
        phone: mkPhone(),
        email: mkEmail(),
        cancerType: 'bladder',
        stage: 'T1N0M0',
        currentStage: 'TREATMENT',
        performanceStatus: 1,
        priorityScore: 55,
        priorityCategory: 'MEDIUM',
        priorityReason: 'BCG intravesical em andamento — NMIBC T1 alto grau',
        status: 'IN_TREATMENT',
        lastInteraction: new Date('2026-04-10T08:30:00Z'),
      },
    });
    patients.push({ id: p.id, name: p.name, currentStage: 'TREATMENT' });

    const diag = await prisma.cancerDiagnosis.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        cancerType: 'bladder',
        icd10Code: 'C67.9',
        tStage: 'T1',
        nStage: 'N0',
        mStage: 'M0',
        stage: 'T1N0M0',
        grade: 'G3',
        histologicalType: 'carcinoma urotelial de alto grau não músculo-invasivo',
        diagnosisDate: new Date('2025-09-15'),
        diagnosisConfirmed: true,
        pathologyReport: 'TURBT: carcinoma urotelial alto grau pT1. Lâmina própria infiltrada. Sem músculo próprio.',
        stagingDate: new Date('2025-09-20'),
        isPrimary: true,
        isActive: true,
      },
    });

    await prisma.treatment.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        diagnosisId: diag.id,
        treatmentType: 'IMMUNOTHERAPY',
        treatmentName: 'BCG Intravesical',
        protocol: 'BCG — indução 6 instilações semanais + manutenção 3 instilações em 3, 6, 12, 18, 24, 30, 36 meses',
        line: 1,
        intent: 'CURATIVE',
        startDate: new Date('2025-10-10'),
        plannedEndDate: new Date('2028-10-10'),
        currentCycle: 3,
        totalCycles: 6,
        cyclesCompleted: 2,
        status: 'ACTIVE',
        isActive: true,
        frequency: 'Semanal (fase de indução)',
        administrationRoute: 'Intravesical',
        medications: [{ name: 'BCG (Bacillus Calmette-Guérin)', dose: '81 mg', route: 'intravesical', frequency: 'semanal' }],
        lastCycleDate: new Date('2026-04-03'),
        lastApplicationDate: new Date('2026-04-03'),
        notes: '3ª instilação da fase de indução. Tolerância boa, cistite reativa leve.',
      },
    });

    await prisma.patientJourney.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        screeningDate: new Date('2025-08-20'),
        screeningResult: 'Hematúria macroscópica — encaminhado para cistoscopia.',
        diagnosisDate: new Date('2025-09-15'),
        diagnosisConfirmed: true,
        stagingDate: new Date('2025-09-20'),
        treatmentStartDate: new Date('2025-10-10'),
        treatmentType: 'IMMUNOTHERAPY',
        treatmentProtocol: 'BCG Intravesical — NMIBC T1 alto grau',
        currentCycle: 3,
        totalCycles: 6,
        nextFollowUpDate: new Date('2026-04-17'),
        currentStep: 'BCG instilação #3 de 6 — fase de indução',
        nextStep: 'Instilação #4 em 17/04/2026',
        blockers: [],
      },
    });

    await prisma.comorbidity.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        name: 'Hipertensão Arterial Sistêmica',
        type: 'HYPERTENSION',
        severity: 'MILD',
        controlled: true,
      },
    });
    await prisma.medication.createMany({
      data: [
        {
          tenantId: tenant.id,
          patientId: p.id,
          name: 'BCG Intravesical (Tice)',
          dosage: '81 mg',
          frequency: 'Semanal',
          indication: 'Câncer de bexiga NMIBC T1',
          route: 'Intravesical',
          category: 'OTHER',
          isActive: true,
          notes: 'Instilação intra-hospitalar pelo urologista',
        },
        {
          tenantId: tenant.id,
          patientId: p.id,
          name: 'Isoniazida',
          dosage: '300 mg',
          frequency: 'No dia da instilação BCG',
          indication: 'Profilaxia de toxicidade sistêmica BCG',
          route: 'VO',
          category: 'OTHER',
          isActive: true,
          notes: 'Tomada 2h antes da instilação',
        },
        {
          tenantId: tenant.id,
          patientId: p.id,
          name: 'Amlodipina',
          dosage: '5 mg',
          frequency: '1x/dia',
          indication: 'HAS',
          route: 'VO',
          category: 'ANTIHYPERTENSIVE',
          isActive: true,
        },
      ],
    });

    await prisma.performanceStatusHistory.createMany({
      data: [
        {
          tenantId: tenant.id,
          patientId: p.id,
          ecogScore: 1,
          assessedAt: new Date('2025-09-15'),
          source: 'MANUAL',
          notes: 'ECOG no diagnóstico',
        },
        {
          tenantId: tenant.id,
          patientId: p.id,
          ecogScore: 1,
          assessedAt: new Date('2026-04-03'),
          source: 'AGENT',
          notes: 'Mantido — sem deterioração durante BCG',
        },
      ],
    });
  }

  // ── TREATMENT 2: Quimio neoadjuvante Gem/Cis — MIBC T2 ──────────────────────
  {
    const p = await prisma.patient.create({
      data: {
        tenantId: tenant.id,
        name: 'Roberto Henrique Fonseca',
        birthDate: new Date(1968, 1, 25), // 58 anos
        gender: 'male',
        phone: mkPhone(),
        email: mkEmail(),
        cancerType: 'bladder',
        stage: 'T2N0M0',
        currentStage: 'TREATMENT',
        performanceStatus: 1,
        priorityScore: 72,
        priorityCategory: 'HIGH',
        priorityReason: 'Quimioterapia neoadjuvante Gemcitabina/Cisplatina — ciclo 2 de 4. Nadir previsto D+10.',
        status: 'IN_TREATMENT',
        clinicalDisposition: 'SCHEDULED_CONSULT',
        clinicalDispositionReason: 'Último ciclo há 12 dias — dentro da janela de nadir. Check-in diário.',
        lastInteraction: new Date('2026-04-09T14:00:00Z'),
      },
    });
    patients.push({ id: p.id, name: p.name, currentStage: 'TREATMENT' });

    const diag = await prisma.cancerDiagnosis.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        cancerType: 'bladder',
        icd10Code: 'C67.9',
        tStage: 'T2',
        nStage: 'N0',
        mStage: 'M0',
        stage: 'T2N0M0 — Estágio II',
        grade: 'G3',
        histologicalType: 'carcinoma urotelial de alto grau músculo-invasivo',
        diagnosisDate: new Date('2025-12-10'),
        diagnosisConfirmed: true,
        pathologyReport: 'TURBT radical: carcinoma urotelial alto grau, infiltração profunda de muscular própria (pT2b).',
        stagingDate: new Date('2025-12-15'),
        isPrimary: true,
        isActive: true,
      },
    });

    await prisma.treatment.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        diagnosisId: diag.id,
        treatmentType: 'CHEMOTHERAPY',
        treatmentName: 'Gemcitabina + Cisplatina (Gem/Cis)',
        protocol: 'Gemcitabina 1000 mg/m² D1+D8 + Cisplatina 70 mg/m² D1 — ciclos de 21 dias',
        line: 1,
        intent: 'NEOADJUVANT',
        startDate: new Date('2026-03-14'),
        plannedEndDate: new Date('2026-06-14'),
        currentCycle: 2,
        totalCycles: 4,
        cyclesCompleted: 1,
        status: 'ACTIVE',
        isActive: true,
        frequency: 'A cada 21 dias',
        administrationRoute: 'IV',
        medications: [
          { name: 'Gemcitabina', dose: '1000 mg/m²', route: 'IV', days: 'D1 e D8' },
          { name: 'Cisplatina', dose: '70 mg/m²', route: 'IV', day: 'D1' },
        ],
        lastCycleDate: new Date('2026-03-28'),
        lastApplicationDate: new Date('2026-03-28'),
        notes: 'Ciclo 2 D1 em 28/03. Tolerância adequada. Náusea grau 1 controlada.',
      },
    });

    await prisma.patientJourney.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        screeningDate: new Date('2025-11-05'),
        screeningResult: 'Hematúria macroscópica com coágulos, dor pélvica.',
        diagnosisDate: new Date('2025-12-10'),
        diagnosisConfirmed: true,
        stagingDate: new Date('2025-12-15'),
        treatmentStartDate: new Date('2026-03-14'),
        treatmentType: 'CHEMOTHERAPY',
        treatmentProtocol: 'Gem/Cis neoadjuvante — MIBC T2N0M0',
        currentCycle: 2,
        totalCycles: 4,
        nextFollowUpDate: new Date('2026-04-18'),
        currentStep: 'Ciclo 2 D1 Gem/Cis — janela D+10 a D+14 (nadir)',
        nextStep: 'D8 Gemcitabina em 05/04 + ciclo 3 D1 em 18/04',
        blockers: [],
      },
    });

    await prisma.comorbidity.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        name: 'Hipertensão Arterial Sistêmica',
        type: 'HYPERTENSION',
        severity: 'MODERATE',
        controlled: true,
      },
    });
    await prisma.medication.createMany({
      data: [
        {
          tenantId: tenant.id,
          patientId: p.id,
          name: 'Gemcitabina',
          dosage: '1000 mg/m²',
          frequency: 'D1 e D8 a cada 21 dias',
          indication: 'Câncer de bexiga MIBC — neoadjuvância',
          route: 'IV',
          category: 'OTHER',
          isActive: true,
        },
        {
          tenantId: tenant.id,
          patientId: p.id,
          name: 'Cisplatina',
          dosage: '70 mg/m²',
          frequency: 'D1 a cada 21 dias',
          indication: 'Câncer de bexiga MIBC — neoadjuvância',
          route: 'IV',
          category: 'OTHER',
          isActive: true,
        },
        {
          tenantId: tenant.id,
          patientId: p.id,
          name: 'Ondansetrona',
          dosage: '8 mg',
          frequency: '3x/dia nos dias de quimio',
          indication: 'Profilaxia de êmese quimioinduzida',
          route: 'VO',
          category: 'ANTIEMETIC',
          isActive: true,
        },
        {
          tenantId: tenant.id,
          patientId: p.id,
          name: 'Dexametasona',
          dosage: '8 mg',
          frequency: 'No dia da quimio',
          indication: 'Antiemétic + anti-inflamatório',
          route: 'IV',
          category: 'CORTICOSTEROID',
          isCorticosteroid: true,
          isActive: true,
        },
        {
          tenantId: tenant.id,
          patientId: p.id,
          name: 'Losartana',
          dosage: '50 mg',
          frequency: '1x/dia',
          indication: 'HAS',
          route: 'VO',
          category: 'ANTIHYPERTENSIVE',
          isActive: true,
        },
      ],
    });

    await prisma.performanceStatusHistory.createMany({
      data: [
        {
          tenantId: tenant.id,
          patientId: p.id,
          ecogScore: 1,
          assessedAt: new Date('2025-12-10'),
          source: 'MANUAL',
          notes: 'ECOG inicial no diagnóstico',
        },
        {
          tenantId: tenant.id,
          patientId: p.id,
          ecogScore: 1,
          assessedAt: new Date('2026-03-28'),
          source: 'AGENT',
          notes: 'Avaliado no D1 ciclo 2 — mantido',
        },
      ],
    });
  }

  // ── TREATMENT 3: Cistectomia radical recente — recuperação pós-op ────────────
  {
    const p = await prisma.patient.create({
      data: {
        tenantId: tenant.id,
        name: 'Paulo César Drummond',
        birthDate: new Date(1960, 7, 30), // 65 anos
        gender: 'male',
        phone: mkPhone(),
        email: mkEmail(),
        cancerType: 'bladder',
        stage: 'T3N1M0',
        currentStage: 'TREATMENT',
        performanceStatus: 2,
        priorityScore: 82,
        priorityCategory: 'CRITICAL',
        priorityReason: 'Pós-cistectomia radical (15 dias) — T3N1M0, vigilância de complicações. ECOG 2.',
        status: 'IN_TREATMENT',
        clinicalDisposition: 'ADVANCE_CONSULT',
        clinicalDispositionReason: 'Febre baixa 37.6°C e fadiga intensa relatadas. Pós-op recente com linfonodo positivo.',
        lastInteraction: new Date('2026-04-10T10:15:00Z'),
      },
    });
    patients.push({ id: p.id, name: p.name, currentStage: 'TREATMENT' });

    const diag = await prisma.cancerDiagnosis.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        cancerType: 'bladder',
        icd10Code: 'C67.9',
        tStage: 'T3',
        nStage: 'N1',
        mStage: 'M0',
        stage: 'T3N1M0 — Estágio III',
        grade: 'G3',
        histologicalType: 'carcinoma urotelial de alto grau com invasão perivesical',
        diagnosisDate: new Date('2025-11-20'),
        diagnosisConfirmed: true,
        pathologyReport: 'Cistectomia radical: pT3b N1 (1 linfonodo obturador positivo). Margens livres.',
        stagingDate: new Date('2025-11-25'),
        isPrimary: true,
        isActive: true,
      },
    });

    await prisma.treatment.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        diagnosisId: diag.id,
        treatmentType: 'CHEMOTHERAPY',
        treatmentName: 'Carboplatina + Gencitabina (neoadjuvante) → Cistectomia radical',
        protocol: 'Carboplatina AUC 5 + Gemcitabina 1000 mg/m² (3 ciclos neoadjuvantes) → Cistectomia radical laparoscópica',
        line: 1,
        intent: 'CURATIVE',
        startDate: new Date('2025-12-01'),
        actualEndDate: new Date('2026-03-26'),
        currentCycle: null,
        totalCycles: 3,
        cyclesCompleted: 3,
        status: 'COMPLETED',
        isActive: false,
        administrationRoute: 'IV',
        hadNeoadjuvantChemo: true,
        neoadjuvantChemoDetail: 'CARBOPLATINA + GEMCITABINA — 3 ciclos',
        admissionDate: new Date('2026-03-24'),
        dischargeDate: new Date('2026-04-02'),
        medications: [
          { name: 'Carboplatina', dose: 'AUC 5', route: 'IV' },
          { name: 'Gemcitabina', dose: '1000 mg/m²', route: 'IV', days: 'D1 e D8' },
        ],
        notes: 'Neoadjuvância concluída. Cistectomia em 26/03. Alta hospitalar em 02/04.',
      },
    });

    await prisma.patientJourney.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        screeningDate: new Date('2025-10-05'),
        screeningResult: 'Hematúria total com coágulos volumosos e dor lombar.',
        diagnosisDate: new Date('2025-11-20'),
        diagnosisConfirmed: true,
        stagingDate: new Date('2025-11-25'),
        treatmentStartDate: new Date('2025-12-01'),
        treatmentType: 'COMBINED',
        treatmentProtocol: 'Neoadjuvância Carbo/Gem + Cistectomia radical — T3N1M0',
        lastFollowUpDate: new Date('2026-04-10'),
        nextFollowUpDate: new Date('2026-04-17'),
        currentStep: 'Recuperação pós-cistectomia radical (D+15)',
        nextStep: 'Revisão cirúrgica D+21 + decisão de adjuvância',
        blockers: ['Febre baixa 37.6°C — investigando sítio cirúrgico'],
      },
    });

    await prisma.comorbidity.createMany({
      data: [
        {
          tenantId: tenant.id,
          patientId: p.id,
          name: 'Diabetes Mellitus tipo 2',
          type: 'DIABETES_TYPE_2',
          severity: 'MODERATE',
          controlled: true,
          increasesSepsisRisk: true,
        },
        {
          tenantId: tenant.id,
          patientId: p.id,
          name: 'Hipertensão Arterial Sistêmica',
          type: 'HYPERTENSION',
          severity: 'MODERATE',
          controlled: true,
        },
        {
          tenantId: tenant.id,
          patientId: p.id,
          name: 'Doença Arterial Coronariana',
          type: 'CORONARY_ARTERY_DISEASE',
          severity: 'MODERATE',
          controlled: true,
          increasesThrombosisRisk: true,
          notes: 'Stent em 2020, em uso de antiagregante',
        },
      ],
    });

    await prisma.medication.createMany({
      data: [
        {
          tenantId: tenant.id,
          patientId: p.id,
          name: 'AAS',
          dosage: '100 mg',
          frequency: '1x/dia',
          indication: 'DAC — profilaxia trombótica',
          route: 'VO',
          category: 'ANTIPLATELET',
          isAntiplatelet: true,
          isActive: true,
          notes: 'Suspenso no perioperatório, reintroduzido em 05/04',
        },
        {
          tenantId: tenant.id,
          patientId: p.id,
          name: 'Insulina NPH',
          dosage: '20 UI',
          frequency: '2x/dia',
          indication: 'DM2',
          route: 'SC',
          category: 'ANTIDIABETIC',
          isActive: true,
        },
        {
          tenantId: tenant.id,
          patientId: p.id,
          name: 'Dipirona',
          dosage: '500 mg',
          frequency: 'SOS dor',
          indication: 'Analgesia pós-operatória',
          route: 'VO',
          category: 'NON_OPIOID_ANALGESIC',
          isActive: true,
        },
        {
          tenantId: tenant.id,
          patientId: p.id,
          name: 'Tramadol',
          dosage: '50 mg',
          frequency: 'A cada 8h SOS dor intensa',
          indication: 'Dor pós-cistectomia',
          route: 'VO',
          category: 'OPIOID_ANALGESIC',
          isOpioid: true,
          isActive: true,
        },
      ],
    });

    await prisma.performanceStatusHistory.createMany({
      data: [
        {
          tenantId: tenant.id,
          patientId: p.id,
          ecogScore: 1,
          assessedAt: new Date('2025-11-20'),
          source: 'MANUAL',
          notes: 'ECOG no diagnóstico',
        },
        {
          tenantId: tenant.id,
          patientId: p.id,
          ecogScore: 2,
          assessedAt: new Date('2026-04-10'),
          source: 'AGENT',
          notes: 'Piora pós-operatória — fadiga e limitação mobilidade',
        },
      ],
    });
  }

  // ── TREATMENT 4: Imunoterapia (atezolizumabe) — T3N2M1 metastático ──────────
  {
    const p = await prisma.patient.create({
      data: {
        tenantId: tenant.id,
        name: 'Marcos Antonio Pereira',
        birthDate: new Date(1958, 1, 5), // 68 anos
        gender: 'male',
        phone: mkPhone(),
        email: mkEmail(),
        cancerType: 'bladder',
        stage: 'T3N2M1',
        currentStage: 'TREATMENT',
        performanceStatus: 2,
        priorityScore: 88,
        priorityCategory: 'CRITICAL',
        priorityReason: 'Imunoterapia — bexiga metastático T3N2M1 PD-L1+. ECOG 2. Alta frequência de check-in.',
        status: 'IN_TREATMENT',
        clinicalDisposition: 'ER_DAYS',
        clinicalDispositionReason: 'R01: Febre 38.2°C relatada há 2 dias. Paciente em imunoterapia — imunossupresso.',
        clinicalDispositionAt: new Date('2026-04-10T07:00:00Z'),
        lastInteraction: new Date('2026-04-10T07:30:00Z'),
      },
    });
    patients.push({ id: p.id, name: p.name, currentStage: 'TREATMENT' });

    const diag = await prisma.cancerDiagnosis.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        cancerType: 'bladder',
        icd10Code: 'C67.9',
        tStage: 'T3',
        nStage: 'N2',
        mStage: 'M1',
        stage: 'T3N2M1 — Estágio IV (metastático)',
        grade: 'G3',
        histologicalType: 'carcinoma urotelial de alto grau com metástases linfonodais e pulmonares',
        diagnosisDate: new Date('2025-08-10'),
        diagnosisConfirmed: true,
        pathologyReport: 'Biopsia: carcinoma urotelial alto grau. TC: nódulos pulmonares bilaterais < 1 cm + LAP pélvica.',
        pdl1Expression: 62.0, // PD-L1 positivo (> 5%)
        stagingDate: new Date('2025-08-15'),
        isPrimary: true,
        isActive: true,
      },
    });

    await prisma.treatment.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        diagnosisId: diag.id,
        treatmentType: 'IMMUNOTHERAPY',
        treatmentName: 'Atezolizumabe (Tecentriq)',
        protocol: 'Atezolizumabe 1200 mg IV a cada 21 dias — 1ª linha para urotélio PD-L1+ inelegível para cisplatina',
        line: 1,
        intent: 'PALLIATIVE',
        startDate: new Date('2026-01-15'),
        currentCycle: 4,
        totalCycles: null, // Até progressão ou toxicidade
        cyclesCompleted: 3,
        status: 'ACTIVE',
        isActive: true,
        frequency: 'A cada 21 dias',
        administrationRoute: 'IV',
        medications: [{ name: 'Atezolizumabe', dose: '1200 mg', route: 'IV', frequency: 'Q21d' }],
        lastCycleDate: new Date('2026-03-27'),
        lastApplicationDate: new Date('2026-03-27'),
        notes: 'Ciclo 4 D1 em 27/03. Febre 38.2°C relatada — investigar pneumonite ou imunomediada.',
      },
    });

    await prisma.patientJourney.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        screeningDate: new Date('2025-07-20'),
        screeningResult: 'Hematúria, perda de peso 8 kg em 2 meses. Encaminhado.',
        diagnosisDate: new Date('2025-08-10'),
        diagnosisConfirmed: true,
        stagingDate: new Date('2025-08-15'),
        treatmentStartDate: new Date('2026-01-15'),
        treatmentType: 'IMMUNOTHERAPY',
        treatmentProtocol: 'Atezolizumabe — 1ª linha urotélio metastático PD-L1+',
        currentCycle: 4,
        nextFollowUpDate: new Date('2026-04-17'),
        currentStep: 'Ciclo 4 atezolizumabe — avaliar febre (evento imunomediado?)',
        nextStep: 'TC de restadimento após ciclo 4',
        blockers: ['Febre 38.2°C há 2 dias — PS urgente vs consulta antecipada'],
      },
    });

    await prisma.comorbidity.createMany({
      data: [
        {
          tenantId: tenant.id,
          patientId: p.id,
          name: 'Hipertensão Arterial Sistêmica',
          type: 'HYPERTENSION',
          severity: 'MODERATE',
          controlled: true,
        },
        {
          tenantId: tenant.id,
          patientId: p.id,
          name: 'Doença Pulmonar Obstrutiva Crônica',
          type: 'COPD',
          severity: 'MILD',
          controlled: true,
          affectsPulmonaryReserve: true,
          notes: 'DPOC leve. Relevante para diagnóstico diferencial de pneumonite imunomediada.',
        },
      ],
    });

    await prisma.medication.createMany({
      data: [
        {
          tenantId: tenant.id,
          patientId: p.id,
          name: 'Atezolizumabe',
          dosage: '1200 mg',
          frequency: 'A cada 21 dias',
          indication: 'Câncer de bexiga urotélio metastático PD-L1+',
          route: 'IV',
          category: 'IMMUNOSUPPRESSANT',
          isImmunosuppressant: true,
          isActive: true,
        },
        {
          tenantId: tenant.id,
          patientId: p.id,
          name: 'Losartana',
          dosage: '100 mg',
          frequency: '1x/dia',
          indication: 'HAS',
          route: 'VO',
          category: 'ANTIHYPERTENSIVE',
          isActive: true,
        },
      ],
    });

    await prisma.performanceStatusHistory.createMany({
      data: [
        {
          tenantId: tenant.id,
          patientId: p.id,
          ecogScore: 1,
          assessedAt: new Date('2025-08-10'),
          source: 'MANUAL',
          notes: 'ECOG no diagnóstico',
        },
        {
          tenantId: tenant.id,
          patientId: p.id,
          ecogScore: 2,
          assessedAt: new Date('2026-03-27'),
          source: 'AGENT',
          notes: 'Piora funcional — fadiga e dispneia discreta',
        },
      ],
    });
  }

  // ── FOLLOW_UP 1: Pós-TURBT Ta, 1 ano de cistoscopias trimestrais ─────────────
  {
    const p = await prisma.patient.create({
      data: {
        tenantId: tenant.id,
        name: 'José Roberto Santos',
        birthDate: new Date(1952, 11, 18), // 73 anos
        gender: 'male',
        phone: mkPhone(),
        email: mkEmail(),
        cancerType: 'bladder',
        stage: 'TaN0M0',
        currentStage: 'FOLLOW_UP',
        performanceStatus: 0,
        priorityScore: 22,
        priorityCategory: 'LOW',
        priorityReason: 'Follow-up pós-TURBT Ta — em remissão, cistoscopia trimestral',
        status: 'FOLLOW_UP',
        lastInteraction: new Date('2026-04-05T10:00:00Z'),
      },
    });
    patients.push({ id: p.id, name: p.name, currentStage: 'FOLLOW_UP' });

    const diag = await prisma.cancerDiagnosis.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        cancerType: 'bladder',
        icd10Code: 'C67.9',
        tStage: 'Ta',
        nStage: 'N0',
        mStage: 'M0',
        stage: 'TaN0M0 — Estágio 0a',
        grade: 'G2',
        histologicalType: 'carcinoma urotelial papilar de baixo grau',
        diagnosisDate: new Date('2025-03-12'),
        diagnosisConfirmed: true,
        pathologyReport: 'TURBT: carcinoma urotelial papilar baixo grau pTa. Ressecção completa com margens livres.',
        stagingDate: new Date('2025-03-15'),
        isPrimary: true,
        isActive: false,
        resolvedDate: new Date('2025-04-10'),
        resolutionReason: 'Ressecção completa confirmada. Em seguimento.',
      },
    });

    await prisma.treatment.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        diagnosisId: diag.id,
        treatmentType: 'SURGERY',
        treatmentName: 'RTU de Bexiga (TURBT)',
        protocol: 'TURBT diagnóstica + terapêutica para tumor Ta',
        line: 1,
        intent: 'CURATIVE',
        startDate: new Date('2025-03-12'),
        actualEndDate: new Date('2025-03-12'),
        cyclesCompleted: 1,
        status: 'COMPLETED',
        isActive: false,
        response: 'COMPLETE_RESPONSE',
        responseDate: new Date('2025-04-10'),
        notes: 'Ressecção completa. Cistoscopia de controle em abril negativa.',
      },
    });

    await prisma.patientJourney.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        screeningDate: new Date('2025-02-20'),
        screeningResult: 'Hematúria microscópica em check-up anual.',
        diagnosisDate: new Date('2025-03-12'),
        diagnosisConfirmed: true,
        stagingDate: new Date('2025-03-15'),
        treatmentStartDate: new Date('2025-03-12'),
        treatmentType: 'SURGERY',
        treatmentProtocol: 'TURBT — Ta baixo grau',
        lastFollowUpDate: new Date('2026-04-05'),
        nextFollowUpDate: new Date('2026-07-05'),
        currentStep: 'Cistoscopia de seguimento trimestral — 3ª avaliação',
        nextStep: 'Cistoscopia trimestral em 05/07/2026',
        blockers: [],
      },
    });

    await prisma.comorbidity.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        name: 'Hipertensão Arterial Sistêmica',
        type: 'HYPERTENSION',
        severity: 'MILD',
        controlled: true,
      },
    });
    await prisma.medication.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        name: 'Atenolol',
        dosage: '25 mg',
        frequency: '1x/dia',
        indication: 'HAS',
        route: 'VO',
        category: 'ANTIHYPERTENSIVE',
        isActive: true,
      },
    });

    await prisma.performanceStatusHistory.createMany({
      data: [
        { tenantId: tenant.id, patientId: p.id, ecogScore: 0, assessedAt: new Date('2025-03-12'), source: 'MANUAL' },
        { tenantId: tenant.id, patientId: p.id, ecogScore: 0, assessedAt: new Date('2026-04-05'), source: 'AGENT', notes: 'Mantido em follow-up' },
      ],
    });
  }

  // ── FOLLOW_UP 2: Pós-cistectomia radical T2N0, 1 ano, TC semestral ──────────
  {
    const p = await prisma.patient.create({
      data: {
        tenantId: tenant.id,
        name: 'Maria Helena Carvalho',
        birthDate: new Date(1964, 4, 22), // 61 anos — única mulher em follow-up
        gender: 'female',
        phone: mkPhone(),
        email: mkEmail(),
        cancerType: 'bladder',
        stage: 'T2N0M0',
        currentStage: 'FOLLOW_UP',
        performanceStatus: 1,
        priorityScore: 28,
        priorityCategory: 'LOW',
        priorityReason: 'Follow-up pós-cistectomia — T2N0M0, 1 ano de remissão. TC semestral normal.',
        status: 'FOLLOW_UP',
        lastInteraction: new Date('2026-03-28T09:00:00Z'),
      },
    });
    patients.push({ id: p.id, name: p.name, currentStage: 'FOLLOW_UP' });

    const diag = await prisma.cancerDiagnosis.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        cancerType: 'bladder',
        icd10Code: 'C67.9',
        tStage: 'T2',
        nStage: 'N0',
        mStage: 'M0',
        stage: 'T2N0M0 — Estágio II',
        grade: 'G3',
        histologicalType: 'carcinoma urotelial de alto grau músculo-invasivo',
        diagnosisDate: new Date('2024-12-05'),
        diagnosisConfirmed: true,
        pathologyReport: 'Cistectomia radical: pT2b N0 M0. Margens cirúrgicas livres. Derivação urinária tipo Bricker.',
        stagingDate: new Date('2024-12-10'),
        isPrimary: true,
        isActive: false,
        resolvedDate: new Date('2025-02-15'),
        resolutionReason: 'Cistectomia com ressecção completa. Margens livres. Em seguimento.',
      },
    });

    await prisma.treatment.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        diagnosisId: diag.id,
        treatmentType: 'SURGERY',
        treatmentName: 'Cistectomia Radical + Derivação Urinária (Bricker)',
        protocol: 'Cistectomia radical laparoscópica assistida por robô + ureterileoestomia cutânea (Bricker)',
        line: 1,
        intent: 'CURATIVE',
        startDate: new Date('2025-02-10'),
        actualEndDate: new Date('2025-02-10'),
        cyclesCompleted: 1,
        status: 'COMPLETED',
        isActive: false,
        hadUrinaryDiversion: true,
        admissionDate: new Date('2025-02-09'),
        dischargeDate: new Date('2025-02-17'),
        response: 'COMPLETE_RESPONSE',
        responseDate: new Date('2025-04-05'),
        notes: 'TC 6 meses (agosto/25): sem evidência de doença. TC 12 meses (fevereiro/26): sem recidiva.',
      },
    });

    await prisma.patientJourney.create({
      data: {
        tenantId: tenant.id,
        patientId: p.id,
        screeningDate: new Date('2024-11-12'),
        screeningResult: 'Hematúria total com sintomas obstrutivos.',
        diagnosisDate: new Date('2024-12-05'),
        diagnosisConfirmed: true,
        stagingDate: new Date('2024-12-10'),
        treatmentStartDate: new Date('2025-02-10'),
        treatmentType: 'SURGERY',
        treatmentProtocol: 'Cistectomia radical — MIBC T2N0M0',
        lastFollowUpDate: new Date('2026-03-28'),
        nextFollowUpDate: new Date('2026-08-28'),
        currentStep: 'Seguimento semestral — 12 meses pós-operatório',
        nextStep: 'TC de seguimento em agosto/2026 + urostomia check',
        blockers: [],
      },
    });

    await prisma.comorbidity.createMany({
      data: [
        {
          tenantId: tenant.id,
          patientId: p.id,
          name: 'Diabetes Mellitus tipo 2',
          type: 'DIABETES_TYPE_2',
          severity: 'MILD',
          controlled: true,
          increasesSepsisRisk: true,
          notes: 'DM2 bem controlada — HbA1c 6.8%',
        },
      ],
    });
    await prisma.medication.createMany({
      data: [
        {
          tenantId: tenant.id,
          patientId: p.id,
          name: 'Metformina',
          dosage: '500 mg',
          frequency: '2x/dia',
          indication: 'DM2',
          route: 'VO',
          category: 'ANTIDIABETIC',
          isActive: true,
        },
        {
          tenantId: tenant.id,
          patientId: p.id,
          name: 'Vitamina B12',
          dosage: '1000 mcg',
          frequency: 'Mensal',
          indication: 'Reposição pós-cistectomia (absorção íleo)',
          route: 'IM',
          category: 'OTHER',
          isActive: true,
          notes: 'Obrigatório pós-derivação tipo Bricker',
        },
      ],
    });

    await prisma.performanceStatusHistory.createMany({
      data: [
        { tenantId: tenant.id, patientId: p.id, ecogScore: 1, assessedAt: new Date('2024-12-05'), source: 'MANUAL' },
        { tenantId: tenant.id, patientId: p.id, ecogScore: 1, assessedAt: new Date('2026-03-28'), source: 'AGENT', notes: 'Adaptada à urostomia, ECOG estável' },
      ],
    });
  }

  console.log(`✅ Pacientes de bexiga criados: ${patients.length}`);
  for (const p of patients) {
    console.log(`  ${p.name} (bladder — ${p.currentStage})`);
  }

  // ─── Conversations e Mensagens ──────────────────────────────────────────────
  let msgCounter = 1;
  const mkMsgId = () => `wamid.seed${String(msgCounter++).padStart(4, '0')}`;

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
    }>
  ) {
    const baseTime = new Date('2026-04-10T08:00:00Z');
    const lastMsg = msgs[msgs.length - 1];
    const lastMsgTime = new Date(baseTime.getTime() + lastMsg.minutesOffset * 60000);

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
      const timestamp = new Date(baseTime.getTime() + msg.minutesOffset * 60000);
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

  // Conversa 1: Carlos (SCREENING) — dúvida sobre preparo para cistoscopia
  const carlosPatient = patients.find((p) => p.name === 'Carlos Eduardo Martins')!;
  await createConversation(carlosPatient.id, 'ACTIVE', 'AGENT', [
    { direction: 'INBOUND', content: 'Bom dia, tenho cistoscopia marcada para semana que vem. Preciso de jejum?', processedBy: 'AGENT', minutesOffset: 0 },
    { direction: 'OUTBOUND', content: 'Bom dia Carlos! Para a cistoscopia diagnóstica geralmente não é necessário jejum, mas confirme com o urologista. O preparo básico é: 1) Higiene íntima no dia; 2) Bexiga parcialmente cheia (não esvaziar completamente antes); 3) Anestésico local será aplicado no local. Tem alguma dúvida sobre o procedimento?', processedBy: 'AGENT', minutesOffset: 1 },
    { direction: 'INBOUND', content: 'Vai doer muito? Estou um pouco ansioso', processedBy: 'AGENT', minutesOffset: 5 },
    { direction: 'OUTBOUND', content: 'É normal sentir ansiedade antes do procedimento. A cistoscopia é realizada com anestésico local e o desconforto costuma ser leve a moderado — semelhante a uma pressão. O exame dura em média 5 a 10 minutos. Qualquer sintoma após o exame (febre, sangramento intenso, dificuldade de urinar), entre em contato imediatamente.', processedBy: 'AGENT', minutesOffset: 6 },
  ]);

  // Conversa 2: Roberto (TREATMENT — Gem/Cis nadir) — sintomas do nadir
  const robertoFonsecaPatient = patients.find((p) => p.name === 'Roberto Henrique Fonseca')!;
  await createConversation(robertoFonsecaPatient.id, 'ESCALATED', 'NURSING', [
    { direction: 'INBOUND', content: 'Estou com febre 38.2 desde ontem e muito cansado. Fiz quimio há 12 dias.', processedBy: 'AGENT', minutesOffset: 30, criticalSymptomsDetected: ['febre'], alertTriggered: true },
    { direction: 'OUTBOUND', content: 'Roberto, febre de 38.2°C durante quimioterapia é um sinal de alerta importante. Como você está fazendo quimio (cisplatina + gemcitabina), você pode estar no período de queda dos glóbulos brancos (nadir), que ocorre entre o 10º e 14º dia após o ciclo. ESTE É UM SINAL DE EMERGÊNCIA. Você deve ir AGORA ao pronto-socorro. Não tome antitérmico sem orientação médica pois pode mascarar outros sintomas. Vou acionar a enfermagem.', processedBy: 'AGENT', minutesOffset: 31, structuredData: { scales: { temperature: 38.2 }, symptoms: { febre: true, fadiga: 8 } }, criticalSymptomsDetected: ['febre neutropênica'], alertTriggered: true },
    { direction: 'OUTBOUND', content: 'Roberto, aqui é a enfermeira Maria. Confirmo — você precisa ir ao PS agora. Febre em paciente em quimioterapia na janela de nadir é emergência. Leve os documentos do seu tratamento. Vou avisar o Dr. João.', processedBy: 'NURSING', minutesOffset: 35 },
    { direction: 'INBOUND', content: 'Estou indo ao PS agora. Minha esposa vai me levar.', processedBy: 'NURSING', minutesOffset: 40 },
  ]);

  // Conversa 3: Paulo (TREATMENT — pós-cistectomia) — febre baixa pós-op
  const pauloPatient = patients.find((p) => p.name === 'Paulo César Drummond')!;
  await createConversation(pauloPatient.id, 'WAITING', 'HYBRID', [
    { direction: 'INBOUND', content: 'Boa tarde, fiz a cirurgia há 15 dias e estou com temperatura 37.6 e dor no local da cirurgia', processedBy: 'AGENT', minutesOffset: 60 },
    { direction: 'OUTBOUND', content: 'Paulo, temperatura 37.6°C em pós-operatório recente (15 dias) pode indicar infecção de sítio cirúrgico. Preciso de mais informações: a ferida cirúrgica está com vermelhidão, calor ou secreção? A dor piorou nos últimos dias?', processedBy: 'AGENT', minutesOffset: 61 },
    { direction: 'INBOUND', content: 'A ferida parece ok mas tem uma área mais vermelha em cima. A dor aumentou um pouco', processedBy: 'AGENT', minutesOffset: 65 },
    { direction: 'OUTBOUND', content: 'Paulo, vermelhidão na ferida com piora de dor e febre baixa após cistectomia requer avaliação presencial. Vou marcar uma consulta antecipada para amanhã com o cirurgião. Enquanto isso: não molhe a ferida, use apenas curativo seco, e se a temperatura passar de 38°C, vá direto ao PS. Vou acionar a equipe agora.', processedBy: 'AGENT', minutesOffset: 66, structuredData: { symptoms: { febre: true, dor_local: 6 }, scales: { temperature: 37.6, pain: 6 } }, alertTriggered: true },
    { direction: 'OUTBOUND', content: 'Paulo, aqui é a Maria. Consultei o Dr. João — você tem consulta amanhã às 9h para avaliação da ferida. Se piorar esta noite, vá ao PS. Fique atento se a febre subir acima de 38°C.', processedBy: 'NURSING', minutesOffset: 75 },
  ]);

  // Conversa 4: Marcos (TREATMENT — imunoterapia, febre + emergência R01) — CRÍTICO
  const marcosPatient = patients.find((p) => p.name === 'Marcos Antonio Pereira')!;
  await createConversation(marcosPatient.id, 'ESCALATED', 'NURSING', [
    { direction: 'INBOUND', content: 'Estou com febre 38.2 há 2 dias e falta de ar leve. Fiz a imunoterapia há 2 semanas.', processedBy: 'AGENT', minutesOffset: 90, criticalSymptomsDetected: ['febre', 'falta de ar'], alertTriggered: true },
    { direction: 'OUTBOUND', content: 'Marcos, ATENÇÃO: febre de 38°C em paciente em uso de atezolizumabe (imunoterapia) é uma emergência. Pode ser pneumonite imunomediada — uma complicação grave. Você deve ir ao PRONTO-SOCORRO IMEDIATAMENTE. NÃO espere. Leve os documentos do seu tratamento com o nome do medicamento. Estou acionando a enfermagem agora.', processedBy: 'AGENT', minutesOffset: 91, structuredData: { scales: { temperature: 38.2 }, symptoms: { febre: true, dispneia: 4 } }, criticalSymptomsDetected: ['febre neutropênica', 'dispneia', 'imunossupressão'], alertTriggered: true },
    { direction: 'OUTBOUND', content: 'Marcos, enfermeira Maria. Confirmo EMERGÊNCIA. Febre + falta de ar em imunossuprimido = PS imediatamente. Já liguei para o Dr. João e ele estará disponível no hospital. Leve: cartão do plano, documento com o nome ATEZOLIZUMABE e dosagem.', processedBy: 'NURSING', minutesOffset: 93 },
    { direction: 'INBOUND', content: 'Entendido. Vou chamar o táxi agora.', processedBy: 'NURSING', minutesOffset: 96 },
  ]);

  // Conversa 5: José (FOLLOW_UP) — check-in rotineiro PRO-CTCAE
  const joseFollowPatient = patients.find((p) => p.name === 'José Roberto Santos')!;
  await createConversation(joseFollowPatient.id, 'ACTIVE', 'AGENT', [
    { direction: 'OUTBOUND', content: 'Bom dia José! É hora do seu check-in semanal de acompanhamento. Como você está se sentindo esta semana? Tem algum sintoma novo para reportar?', processedBy: 'AGENT', minutesOffset: 0 },
    { direction: 'INBOUND', content: 'Bom dia! Estou bem, sem nada novo. Só um pouco de cansaço, mas acho que é do calor', processedBy: 'AGENT', minutesOffset: 8 },
    { direction: 'OUTBOUND', content: 'Que ótima notícia, José! Para confirmar que está tudo bem: 1) Você notou alguma alteração na urina (cor, cheiro, sangue)? 2) Alguma dor pélvica ou na região lombar? 3) Dificuldade para urinar?', processedBy: 'AGENT', minutesOffset: 9 },
    { direction: 'INBOUND', content: 'Nada disso. Urina normal, sem dor. Próxima cistoscopia é em julho, né?', processedBy: 'AGENT', minutesOffset: 15 },
    { direction: 'OUTBOUND', content: 'Isso mesmo, José! Sua próxima cistoscopia de seguimento está agendada para 05/07/2026. Continue hidratado (pelo menos 2 litros de água por dia) e evite fumo. Se aparecer qualquer sangue na urina ou dor ao urinar antes disso, entre em contato imediatamente. Até o próximo check-in!', processedBy: 'AGENT', minutesOffset: 16 },
  ]);

  // Conversa 6: Renata (DIAGNOSIS) — ansiedade pré-TURBT
  const renataPatient = patients.find((p) => p.name === 'Renata Sousa Lima')!;
  await createConversation(renataPatient.id, 'ACTIVE', 'AGENT', [
    { direction: 'INBOUND', content: 'Boa tarde, estou muito ansiosa aguardando a data da cirurgia. Faz 3 semanas que soube do resultado da cistoscopia', processedBy: 'AGENT', minutesOffset: 120 },
    { direction: 'OUTBOUND', content: 'Renata, é completamente compreensível sentir ansiedade neste momento. Aguardar uma cirurgia é emocionalmente difícil. A boa notícia é que o tipo de lesão identificado na sua cistoscopia (papilar superficial Ta) costuma ter excelente resultado com o tratamento. Quer conversar sobre o que mais está te preocupando?', processedBy: 'AGENT', minutesOffset: 121 },
    { direction: 'INBOUND', content: 'Tenho medo de que o resultado da cirurgia seja pior do que o previsto. E se for mais grave?', processedBy: 'AGENT', minutesOffset: 125 },
    { direction: 'OUTBOUND', content: 'Seu medo é muito válido. O TURBT serve justamente para dar a resposta definitiva sobre o grau e profundidade do tumor. O médico utilizará esses dados para planejar o tratamento mais adequado. Independente do resultado, você estará no lugar certo, sendo acompanhada pela equipe. Você tem apoio em casa? Família ou amigos próximos?', processedBy: 'AGENT', minutesOffset: 126 },
  ]);

  const totalMessages = msgCounter - 1;
  console.log(`✅ Conversas e mensagens criadas: 6 conversas, ${totalMessages} mensagens`);

  // ─── Alertas clínicos ────────────────────────────────────────────────────────
  // Alerta crítico: Roberto (Gem/Cis, febre no nadir)
  const robertoFonseca = patients.find((p) => p.name === 'Roberto Henrique Fonseca')!;
  await prisma.alert.create({
    data: {
      tenantId: tenant.id,
      patientId: robertoFonseca.id,
      type: 'CRITICAL_SYMPTOM',
      severity: 'CRITICAL',
      message: 'Febre 38.2°C — D+12 após Gem/Cis ciclo 2. Suspeita de neutropenia febril. Paciente encaminhado ao PS.',
      context: { symptoms: ['febre neutropênica'], temperature: 38.2, daysSinceChemo: 12, chemoCycle: 2 },
      status: 'ACKNOWLEDGED',
    },
  });

  // Alerta crítico: Marcos (imunoterapia, febre + dispneia — R01/R11)
  const marcosAntonio = patients.find((p) => p.name === 'Marcos Antonio Pereira')!;
  await prisma.alert.create({
    data: {
      tenantId: tenant.id,
      patientId: marcosAntonio.id,
      type: 'CRITICAL_SYMPTOM',
      severity: 'CRITICAL',
      message: 'ER_IMMEDIATE (R11): Febre 38.2°C em paciente em uso de atezolizumabe (imunossupressor) + dispneia. Suspeita de pneumonite imunomediada. Paciente orientado a ir ao PS.',
      context: { symptoms: ['febre neutropênica', 'dispneia'], temperature: 38.2, immunotherapy: 'atezolizumabe', clinicalDisposition: 'ER_IMMEDIATE' },
      status: 'PENDING',
    },
  });

  // Alerta HIGH: Paulo (pós-cistectomia, febre baixa — sítio cirúrgico)
  const pauloDrummond = patients.find((p) => p.name === 'Paulo César Drummond')!;
  await prisma.alert.create({
    data: {
      tenantId: tenant.id,
      patientId: pauloDrummond.id,
      type: 'CRITICAL_SYMPTOM',
      severity: 'HIGH',
      message: 'Febre baixa 37.6°C + vermelhidão em ferida cirúrgica — D+15 pós-cistectomia radical. Consulta antecipada agendada.',
      context: { symptoms: ['febre subfébrile', 'infecção sítio cirúrgico'], temperature: 37.6, daysPostSurgery: 15 },
      status: 'ACKNOWLEDGED',
    },
  });

  // ─── AgentConfig ────────────────────────────────────────────────────────────
  const existingAgentConfig = await prisma.agentConfig.findUnique({
    where: { tenantId: tenant.id },
  });
  if (!existingAgentConfig) {
    await prisma.agentConfig.create({
      data: {
        tenantId: tenant.id,
        llmProvider: 'anthropic',
        llmModel: 'claude-haiku-4-5',
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
  const protocolTypes = ['colorectal', 'bladder', 'renal', 'prostate', 'breast'];
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

  // ─── Catálogo global de exames (TUSS / fallback local) ─────────────────────
  let examCatalogUpserts = 0;
  for (const row of EXAM_CATALOG_SEED_ROWS) {
    await prisma.examCatalogItem.upsert({
      where: { code: row.code },
      create: {
        code: row.code,
        name: row.name,
        type: row.type,
        rolItemCode: row.rolItemCode ?? null,
        specimenDefault: row.specimenDefault ?? null,
        unit: row.unit ?? null,
        referenceRange: row.referenceRange ?? null,
        sourceVersion: 'prisma-seed',
      },
      update: {
        name: row.name,
        type: row.type,
        rolItemCode: row.rolItemCode ?? null,
        specimenDefault: row.specimenDefault ?? null,
        unit: row.unit ?? null,
        referenceRange: row.referenceRange ?? null,
      },
    });
    examCatalogUpserts++;
  }
  console.log(
    `✅ Catálogo de exames (exam_catalog_items): ${examCatalogUpserts} itens (upsert)`,
  );

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
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
