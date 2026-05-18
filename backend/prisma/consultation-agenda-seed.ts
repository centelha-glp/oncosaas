/**
 * Dados de demonstração para /agenda (NavigationStep de consulta + ConsultationAgendaConfig).
 *
 * Idempotente: remove etapas com metadata.seedTag antes de recriar.
 * Datas relativas a «hoje» em America/Sao_Paulo — visíveis após login:
 *   oncologista@hospitalteste.com | enfermeira@hospitalteste.com | secretaria@hospitalteste.com
 *   Senha: senha123
 */
import { addDays } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { PrismaClient } from '@generated/prisma/client';
import {
  AppointmentConfirmationStatus,
  JourneyStage,
  NavigationStepStatus,
  UserRole,
} from '@generated/prisma/client';

export const CONSULTATION_AGENDA_SEED_TAG = 'consultation_agenda_demo';

const TZ = 'America/Sao_Paulo';

const AGENDA_WEEKLY_PATTERN = {
  activeWeekdays: [1, 2, 3, 4, 5],
  shifts: [
    { startLocal: '08:00', endLocal: '12:00' },
    { startLocal: '13:00', endLocal: '17:00' },
  ],
};

/** Instante de início do slot no fuso America/Sao_Paulo. */
export function spConsultationSlot(daysFromToday: number, hhmm: string): Date {
  const base = addDays(new Date(), daysFromToday);
  const ymd = formatInTimeZone(base, TZ, 'yyyy-MM-dd');
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) {
    throw new Error(`Horário inválido: ${hhmm}`);
  }
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const wall = `${ymd}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
  return fromZonedTime(wall, TZ);
}

type SeedUserIds = {
  oncologistId: string;
  nurseId: string;
  coordinatorId: string;
};

type PatientRef = { id: string; name: string };

async function findPatientByName(
  patients: PatientRef[],
  nameIncludes: string
): Promise<PatientRef> {
  const found = patients.find((p) => p.name.includes(nameIncludes));
  if (!found) {
    throw new Error(
      `Paciente seed não encontrado (nome contém "${nameIncludes}"). Rode o seed completo.`,
    );
  }
  return found;
}

async function firstActiveDiagnosisId(
  prisma: PrismaClient,
  tenantId: string,
  patientId: string
): Promise<string | undefined> {
  const diag = await prisma.cancerDiagnosis.findFirst({
    where: { tenantId, patientId, isActive: true },
    select: { id: true },
    orderBy: { diagnosisDate: 'desc' },
  });
  return diag?.id;
}

export async function seedConsultationAgendaDemo(params: {
  prisma: PrismaClient;
  tenantId: string;
  users: SeedUserIds;
  patients: PatientRef[];
}): Promise<{ stepsCreated: number; configsUpserted: number }> {
  const { prisma, tenantId, users, patients } = params;

  const fernando = await findPatientByName(patients, 'Fernando Augusto');
  const roberto = await findPatientByName(patients, 'Roberto Henrique');
  const paulo = await findPatientByName(patients, 'Paulo César');
  const marcos = await findPatientByName(patients, 'Marcos Antonio');

  const diagFernando = await firstActiveDiagnosisId(prisma, tenantId, fernando.id);
  const diagRoberto = await firstActiveDiagnosisId(prisma, tenantId, roberto.id);
  const diagPaulo = await firstActiveDiagnosisId(prisma, tenantId, paulo.id);
  const diagMarcos = await firstActiveDiagnosisId(prisma, tenantId, marcos.id);

  await prisma.navigationStep.deleteMany({
    where: {
      tenantId,
      metadata: {
        path: ['seedTag'],
        equals: CONSULTATION_AGENDA_SEED_TAG,
      },
    },
  });

  let configsUpserted = 0;
  for (const userId of [
    users.oncologistId,
    users.nurseId,
    users.coordinatorId,
  ]) {
    await prisma.consultationAgendaConfig.upsert({
      where: { userId },
      create: {
        tenantId,
        userId,
        defaultConsultationDurationMinutes: 30,
        maxConsultationsPerDay: 16,
        weeklyPattern: AGENDA_WEEKLY_PATTERN,
        whatsappConfirmationLeadHours: 24,
      },
      update: {
        defaultConsultationDurationMinutes: 30,
        maxConsultationsPerDay: 16,
        weeklyPattern: AGENDA_WEEKLY_PATTERN,
        whatsappConfirmationLeadHours: 24,
      },
    });
    configsUpserted++;
  }

  const meta = { seedTag: CONSULTATION_AGENDA_SEED_TAG };

  const now = new Date();
  const checkedInEarlier = new Date(now.getTime() - 25 * 60_000);

  const steps = [
    // ── Oncologista — hoje e semana ─────────────────────────────────────────
    {
      tenantId,
      patientId: fernando.id,
      diagnosisId: diagFernando,
      cancerType: 'bladder',
      journeyStage: JourneyStage.TREATMENT,
      stepKey: 'specialist_consultation',
      stepName: 'Consulta oncológica',
      status: NavigationStepStatus.PENDING,
      appointmentConfirmationStatus: AppointmentConfirmationStatus.CONFIRMED,
      expectedDate: spConsultationSlot(0, '09:00'),
      dueDate: spConsultationSlot(0, '09:30'),
      scheduledProfessionalId: users.oncologistId,
      metadata: meta,
      notes: '[seed agenda] Hoje 09h — confirmada WhatsApp',
    },
    {
      tenantId,
      patientId: roberto.id,
      diagnosisId: diagRoberto,
      cancerType: 'bladder',
      journeyStage: JourneyStage.TREATMENT,
      stepKey: 'specialist_consultation',
      stepName: 'Consulta oncológica',
      status: NavigationStepStatus.PENDING,
      appointmentConfirmationStatus: AppointmentConfirmationStatus.AWAITING_RESPONSE,
      expectedDate: spConsultationSlot(0, '10:30'),
      dueDate: spConsultationSlot(0, '11:00'),
      scheduledProfessionalId: users.oncologistId,
      consultationCheckedInAt: checkedInEarlier,
      consultationCheckedInByUserId: users.oncologistId,
      metadata: meta,
      notes: '[seed agenda] Hoje 10h30 — aguardando confirmação; check-in para fila',
    },
    {
      tenantId,
      patientId: paulo.id,
      diagnosisId: diagPaulo,
      cancerType: 'bladder',
      journeyStage: JourneyStage.TREATMENT,
      stepKey: 'specialist_consultation',
      stepName: 'Consulta oncológica',
      status: NavigationStepStatus.PENDING,
      appointmentConfirmationStatus: AppointmentConfirmationStatus.NOT_APPLICABLE,
      expectedDate: spConsultationSlot(0, '14:00'),
      dueDate: spConsultationSlot(0, '14:30'),
      scheduledProfessionalId: users.oncologistId,
      metadata: meta,
      notes: '[seed agenda] Hoje 14h — pendente',
    },
    {
      tenantId,
      patientId: marcos.id,
      diagnosisId: diagMarcos,
      cancerType: 'bladder',
      journeyStage: JourneyStage.TREATMENT,
      stepKey: 'specialist_consultation',
      stepName: 'Consulta oncológica',
      status: NavigationStepStatus.OVERDUE,
      appointmentConfirmationStatus: AppointmentConfirmationStatus.AWAITING_RESPONSE,
      expectedDate: spConsultationSlot(-1, '11:00'),
      dueDate: spConsultationSlot(-1, '11:30'),
      scheduledProfessionalId: users.oncologistId,
      metadata: meta,
      notes: '[seed agenda] Ontem 11h — atrasada (OVERDUE)',
    },
    {
      tenantId,
      patientId: fernando.id,
      diagnosisId: diagFernando,
      cancerType: 'bladder',
      journeyStage: JourneyStage.TREATMENT,
      stepKey: 'specialist_consultation',
      stepName: 'Consulta oncológica — retorno',
      status: NavigationStepStatus.PENDING,
      appointmentConfirmationStatus: AppointmentConfirmationStatus.CONFIRMED,
      expectedDate: spConsultationSlot(1, '09:30'),
      dueDate: spConsultationSlot(1, '10:00'),
      scheduledProfessionalId: users.oncologistId,
      metadata: meta,
      notes: '[seed agenda] Amanhã — vaga na overview',
    },
    {
      tenantId,
      patientId: roberto.id,
      diagnosisId: diagRoberto,
      cancerType: 'bladder',
      journeyStage: JourneyStage.TREATMENT,
      stepKey: 'specialist_consultation',
      stepName: 'Consulta oncológica',
      status: NavigationStepStatus.PENDING,
      appointmentConfirmationStatus: AppointmentConfirmationStatus.NOT_APPLICABLE,
      expectedDate: spConsultationSlot(3, '15:00'),
      dueDate: spConsultationSlot(3, '15:30'),
      scheduledProfessionalId: users.oncologistId,
      metadata: meta,
      notes: '[seed agenda] Daqui 3 dias — semana atual',
    },
    {
      tenantId,
      patientId: paulo.id,
      diagnosisId: diagPaulo,
      cancerType: 'bladder',
      journeyStage: JourneyStage.TREATMENT,
      stepKey: 'specialist_consultation',
      stepName: 'Consulta oncológica (cancelada)',
      status: NavigationStepStatus.CANCELLED,
      appointmentConfirmationStatus: AppointmentConfirmationStatus.DECLINED,
      expectedDate: spConsultationSlot(0, '16:00'),
      dueDate: spConsultationSlot(0, '16:30'),
      scheduledProfessionalId: users.oncologistId,
      metadata: meta,
      notes:
        '[seed agenda] Cancelada — não aparece na lista padrão da agenda (filtro exclui CANCELLED)',
    },
    // ── Coordenador — outro profissional no filtro da secretária ─────────────
    {
      tenantId,
      patientId: marcos.id,
      diagnosisId: diagMarcos,
      cancerType: 'bladder',
      journeyStage: JourneyStage.TREATMENT,
      stepKey: 'specialist_consultation',
      stepName: 'Consulta de coordenação',
      status: NavigationStepStatus.PENDING,
      appointmentConfirmationStatus: AppointmentConfirmationStatus.CONFIRMED,
      expectedDate: spConsultationSlot(0, '11:00'),
      dueDate: spConsultationSlot(0, '11:30'),
      scheduledProfessionalId: users.coordinatorId,
      metadata: meta,
      notes: '[seed agenda] Hoje — Carlos Oliveira (coordenador)',
    },
    // ── Enfermeira — navigation_consultation ───────────────────────────────
    {
      tenantId,
      patientId: fernando.id,
      diagnosisId: diagFernando,
      cancerType: 'bladder',
      journeyStage: JourneyStage.TREATMENT,
      stepKey: 'navigation_consultation',
      stepName: 'Consulta de enfermagem',
      status: NavigationStepStatus.PENDING,
      appointmentConfirmationStatus: AppointmentConfirmationStatus.CONFIRMED,
      expectedDate: spConsultationSlot(0, '08:30'),
      dueDate: spConsultationSlot(0, '09:00'),
      scheduledProfessionalId: users.nurseId,
      metadata: meta,
      notes: '[seed agenda] Enfermagem hoje 08h30',
    },
    {
      tenantId,
      patientId: marcos.id,
      diagnosisId: diagMarcos,
      cancerType: 'bladder',
      journeyStage: JourneyStage.TREATMENT,
      stepKey: 'navigation_consultation',
      stepName: 'Consulta de enfermagem',
      status: NavigationStepStatus.PENDING,
      appointmentConfirmationStatus: AppointmentConfirmationStatus.AWAITING_RESPONSE,
      expectedDate: spConsultationSlot(0, '13:30'),
      dueDate: spConsultationSlot(0, '14:00'),
      scheduledProfessionalId: users.nurseId,
      metadata: meta,
      notes: '[seed agenda] Enfermagem hoje 13h30 — aguardando WhatsApp',
    },
    {
      tenantId,
      patientId: roberto.id,
      diagnosisId: diagRoberto,
      cancerType: 'bladder',
      journeyStage: JourneyStage.TREATMENT,
      stepKey: 'navigation_consultation',
      stepName: 'Consulta de enfermagem',
      status: NavigationStepStatus.PENDING,
      appointmentConfirmationStatus: AppointmentConfirmationStatus.NOT_APPLICABLE,
      expectedDate: spConsultationSlot(2, '10:00'),
      dueDate: spConsultationSlot(2, '10:30'),
      scheduledProfessionalId: users.nurseId,
      metadata: meta,
      notes: '[seed agenda] Enfermagem em +2 dias',
    },
  ];

  const result = await prisma.navigationStep.createMany({ data: steps });

  return { stepsCreated: result.count, configsUpserted };
}

/** Utilizador secretária para testes da agenda global. */
export async function upsertSecretaryUser(
  prisma: PrismaClient,
  tenantId: string,
  hashedPassword: string
): Promise<{ id: string; email: string }> {
  const secretary = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId,
        email: 'secretaria@hospitalteste.com',
      },
    },
    update: {},
    create: {
      email: 'secretaria@hospitalteste.com',
      password: hashedPassword,
      name: 'Ana Secretária',
      role: UserRole.SECRETARY,
      tenantId,
    },
  });
  return { id: secretary.id, email: secretary.email };
}
