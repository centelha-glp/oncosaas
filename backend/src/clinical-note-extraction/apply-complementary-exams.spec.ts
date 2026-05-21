import { ComplementaryExamType, Prisma } from '@generated/prisma/client';
import { applyComplementaryExamsFromAiItems } from './apply-complementary-exams';
import type { AiComplementaryExamItem } from './clinical-note-extraction.types';

function makeTx() {
  const exams: Array<{
    id: string;
    tenantId: string;
    patientId: string;
    type: ComplementaryExamType;
    name: string;
    code: string | null;
    loincCode: string | null;
  }> = [];
  const results: Array<{
    id: string;
    tenantId: string;
    examId: string;
    performedAt: Date;
    deletedAt: Date | null;
    valueNumeric: number | null;
    collectionId?: string | null;
  }> = [];
  let examSeq = 0;
  let resSeq = 0;

  return {
    exams,
    results,
    tx: {
      complementaryExam: {
        findMany: jest.fn(
          async ({
            where,
          }: {
            where: {
              tenantId: string;
              patientId: string;
              type?: ComplementaryExamType;
            };
          }) =>
            exams.filter(
              (e) =>
                e.tenantId === where.tenantId &&
                e.patientId === where.patientId &&
                (where.type === undefined || e.type === where.type),
            ),
        ),
        create: jest.fn(
          async ({
            data,
          }: {
            data: {
              tenantId: string;
              patientId: string;
              type: ComplementaryExamType;
              name: string;
              code: string | null;
              loincCode: string | null;
            };
          }) => {
            examSeq += 1;
            const row = {
              id: `exam-${examSeq}`,
              ...data,
            };
            exams.push(row);
            return row;
          },
        ),
      },
      complementaryExamResult: {
        findFirst: jest.fn(
          async ({
            where,
          }: {
            where: {
              tenantId: string;
              examId: string;
              performedAt: Date;
              deletedAt: null;
            };
          }) =>
            results.find(
              (r) =>
                r.tenantId === where.tenantId &&
                r.examId === where.examId &&
                r.performedAt.getTime() === where.performedAt.getTime() &&
                r.deletedAt === null,
            ) ?? null,
        ),
        create: jest.fn(
          async ({
            data,
          }: {
            data: {
              tenantId: string;
              examId: string;
              performedAt: Date;
              valueNumeric?: number | null;
              collectionId?: string;
            };
          }) => {
            resSeq += 1;
            const row = {
              id: `res-${resSeq}`,
              deletedAt: null as Date | null,
              valueNumeric: data.valueNumeric ?? null,
              ...data,
            };
            results.push(row);
            return row;
          },
        ),
        update: jest.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: { valueNumeric?: number | null };
          }) => {
            const row = results.find((r) => r.id === where.id);
            if (!row) {throw new Error('not found');}
            if (data.valueNumeric !== undefined) {
              row.valueNumeric = data.valueNumeric;
            }
            return row;
          },
        ),
      },
    },
  };
}

describe('applyComplementaryExamsFromAiItems', () => {
  const baseArgs = {
    tenantId: 't1',
    patientId: 'p1',
    mergedRejections: [] as Array<{
      domain: string;
      reason: string;
      field?: string | null;
    }>,
  };

  it('dois itens mesmo nome e datas diferentes → 1 exam create, 2 results', async () => {
    const { tx, exams, results } = makeTx();
    const items: AiComplementaryExamItem[] = [
      {
        type: 'LABORATORY',
        name: 'Hemoglobina',
        result: { performed_at: '2025-01-01', value_numeric: 12 },
      },
      {
        type: 'LABORATORY',
        name: 'Hemoglobina',
        result: { performed_at: '2025-02-01', value_numeric: 13 },
      },
    ];

    const out = await applyComplementaryExamsFromAiItems(
      tx as unknown as Prisma.TransactionClient,
      baseArgs,
      items,
    );

    expect(exams).toHaveLength(1);
    expect(results).toHaveLength(2);
    expect(out.complementaryExamIds).toEqual(['exam-1']);
    expect(out.complementaryExamResultIds).toHaveLength(2);
  });

  it('mesmo performedAt → 1 result (update)', async () => {
    const { tx, results } = makeTx();
    const items: AiComplementaryExamItem[] = [
      {
        type: 'LABORATORY',
        name: 'Creatinina',
        result: {
          performed_at: '2025-06-15T10:30:00.000Z',
          value_numeric: 1.0,
        },
      },
      {
        type: 'LABORATORY',
        name: 'Creatinina',
        result: {
          performed_at: '2025-06-15T10:30:00.000Z',
          value_numeric: 1.2,
        },
      },
    ];

    const out = await applyComplementaryExamsFromAiItems(
      tx as unknown as Prisma.TransactionClient,
      baseArgs,
      items,
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.valueNumeric).toBe(1.2);
    expect(out.complementaryExamResultIds).toEqual(['res-1', 'res-1']);
  });

  it('mesmo dia com horários diferentes → 2 results', async () => {
    const { tx, results } = makeTx();
    const items: AiComplementaryExamItem[] = [
      {
        type: 'LABORATORY',
        name: 'Glicemia',
        result: {
          performed_at: '2025-03-10T08:00:00.000Z',
          value_numeric: 90,
        },
      },
      {
        type: 'LABORATORY',
        name: 'Glicemia',
        result: {
          performed_at: '2025-03-10T18:00:00.000Z',
          value_numeric: 110,
        },
      },
    ];

    await applyComplementaryExamsFromAiItems(
      tx as unknown as Prisma.TransactionClient,
      baseArgs,
      items,
    );

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.performedAt.toISOString())).toEqual([
      '2025-03-10T08:00:00.000Z',
      '2025-03-10T18:00:00.000Z',
    ]);
  });

  it('mesmo lote reutiliza exame (batchCache)', async () => {
    const { tx, exams } = makeTx();
    const items: AiComplementaryExamItem[] = [
      {
        type: 'LABORATORY',
        name: 'TTPa',
        result: { performed_at: '2025-01-01', value_numeric: 28 },
      },
      {
        type: 'LABORATORY',
        name: 'TTPa',
        result: { performed_at: '2025-02-01', value_numeric: 30 },
      },
    ];

    await applyComplementaryExamsFromAiItems(
      tx as unknown as Prisma.TransactionClient,
      baseArgs,
      items,
    );

    expect(tx.complementaryExam.create).toHaveBeenCalledTimes(1);
    expect(exams).toHaveLength(1);
  });

  it('YYYY-MM-DD usa início do dia UTC', async () => {
    const { tx, results } = makeTx();
    await applyComplementaryExamsFromAiItems(
      tx as unknown as Prisma.TransactionClient,
      baseArgs,
      [
        {
          type: 'LABORATORY',
          name: 'Hb',
          result: { performed_at: '2025-04-20', value_numeric: 14 },
        },
      ],
    );
    expect(results[0]?.performedAt.toISOString()).toBe('2025-04-20T00:00:00.000Z');
  });

  it('creatinina + eTFG no mesmo dia preserva as duas métricas em exames separados', async () => {
    const { tx, exams, results } = makeTx();
    const items: AiComplementaryExamItem[] = [
      {
        type: 'LABORATORY',
        name: 'Creatinina',
        code: 'CREAT',
        result: { performed_at: '2025-01-01', value_numeric: 1.0 },
      },
      {
        type: 'LABORATORY',
        name: 'eTFG',
        result: { performed_at: '2025-01-01', value_numeric: 72 },
      },
    ];

    await applyComplementaryExamsFromAiItems(
      tx as unknown as Prisma.TransactionClient,
      baseArgs,
      items,
    );

    expect(exams).toHaveLength(2);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.valueNumeric)).toEqual([1.0, 72]);
    expect(tx.complementaryExam.create).toHaveBeenCalledTimes(2);
  });

  it('creatinina com painel eTFG no nome reutiliza mesmo exame', async () => {
    const { tx, exams } = makeTx();
    await applyComplementaryExamsFromAiItems(
      tx as unknown as Prisma.TransactionClient,
      baseArgs,
      [
        {
          type: 'LABORATORY',
          name: 'Creatinina',
          result: { performed_at: '2025-01-01', value_numeric: 1.1 },
        },
        {
          type: 'LABORATORY',
          name: 'Dosagem de Creatinina com eTFG',
          result: { performed_at: '2025-02-01', value_numeric: 1.0 },
        },
      ],
    );
    expect(exams).toHaveLength(1);
  });

  it('sinónimos vitamina D 25-OH → 1 exam', async () => {
    const { tx, exams } = makeTx();
    await applyComplementaryExamsFromAiItems(
      tx as unknown as Prisma.TransactionClient,
      baseArgs,
      [
        {
          type: 'LABORATORY',
          name: 'Vitamina D 25(OH)D',
          result: { performed_at: '2025-01-01', value_numeric: 32 },
        },
        {
          type: 'LABORATORY',
          name: '25-Hidroxi-Vitamina D',
          result: { performed_at: '2025-03-01', value_numeric: 28 },
        },
      ],
    );
    expect(exams).toHaveLength(1);
    expect(tx.complementaryExam.create).toHaveBeenCalledTimes(1);
  });
});
