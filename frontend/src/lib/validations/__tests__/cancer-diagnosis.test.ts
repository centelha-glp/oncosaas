import { describe, it, expect } from 'vitest';
import { cancerDiagnosisSchema } from '../cancer-diagnosis';

const base = {
  cancerType: 'Bexiga',
  diagnosisDate: '2023-08-15',
};

describe('cancerDiagnosisSchema — campos obrigatórios', () => {
  it('aceita diagnóstico mínimo válido', () => {
    expect(cancerDiagnosisSchema.safeParse(base).success).toBe(true);
  });

  it('rejeita cancerType vazio', () => {
    const result = cancerDiagnosisSchema.safeParse({ ...base, cancerType: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain('obrigatório');
  });

  it('rejeita diagnosisDate vazia', () => {
    const result = cancerDiagnosisSchema.safeParse({ ...base, diagnosisDate: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain('obrigatória');
  });
});

describe('cancerDiagnosisSchema — estadiamento TNM', () => {
  it('aceita combinação válida de TNM + grade', () => {
    const result = cancerDiagnosisSchema.safeParse({
      ...base,
      tStage: 'T2',
      nStage: 'N0',
      mStage: 'M0',
      grade: 'G2',
    });
    expect(result.success).toBe(true);
  });

  it('aceita todos os valores válidos de tStage', () => {
    ['T1', 'T2', 'T3', 'T4', 'Tis', 'Tx'].forEach((tStage) => {
      expect(cancerDiagnosisSchema.safeParse({ ...base, tStage }).success, `tStage ${tStage}`).toBe(true);
    });
  });

  it('rejeita tStage inválido', () => {
    expect(cancerDiagnosisSchema.safeParse({ ...base, tStage: 'T9' }).success).toBe(false);
  });

  it('aceita todos os valores válidos de nStage', () => {
    ['N0', 'N1', 'N2', 'N3', 'Nx'].forEach((nStage) => {
      expect(cancerDiagnosisSchema.safeParse({ ...base, nStage }).success, `nStage ${nStage}`).toBe(true);
    });
  });

  it('rejeita nStage inválido', () => {
    expect(cancerDiagnosisSchema.safeParse({ ...base, nStage: 'N9' }).success).toBe(false);
  });

  it('aceita todos os valores válidos de mStage', () => {
    ['M0', 'M1', 'Mx'].forEach((mStage) => {
      expect(cancerDiagnosisSchema.safeParse({ ...base, mStage }).success, `mStage ${mStage}`).toBe(true);
    });
  });

  it('rejeita mStage inválido', () => {
    expect(cancerDiagnosisSchema.safeParse({ ...base, mStage: 'M9' }).success).toBe(false);
  });

  it('aceita todos os valores válidos de grade', () => {
    ['G1', 'G2', 'G3', 'G4', 'Gx'].forEach((grade) => {
      expect(cancerDiagnosisSchema.safeParse({ ...base, grade }).success, `grade ${grade}`).toBe(true);
    });
  });
});

describe('cancerDiagnosisSchema — biomarcadores mama', () => {
  it('aceita her2Status positivo/negativo/indeterminado', () => {
    ['positivo', 'negativo', 'indeterminado'].forEach((her2Status) => {
      expect(cancerDiagnosisSchema.safeParse({ ...base, her2Status }).success).toBe(true);
    });
  });

  it('rejeita her2Status inválido', () => {
    expect(cancerDiagnosisSchema.safeParse({ ...base, her2Status: 'equivocado' }).success).toBe(false);
  });

  it('valida ki67Percentage entre 0 e 100', () => {
    expect(cancerDiagnosisSchema.safeParse({ ...base, ki67Percentage: 0 }).success).toBe(true);
    expect(cancerDiagnosisSchema.safeParse({ ...base, ki67Percentage: 75 }).success).toBe(true);
    expect(cancerDiagnosisSchema.safeParse({ ...base, ki67Percentage: 100 }).success).toBe(true);
  });

  it('rejeita ki67Percentage negativo', () => {
    expect(cancerDiagnosisSchema.safeParse({ ...base, ki67Percentage: -1 }).success).toBe(false);
  });

  it('rejeita ki67Percentage maior que 100', () => {
    expect(cancerDiagnosisSchema.safeParse({ ...base, ki67Percentage: 101 }).success).toBe(false);
  });
});

describe('cancerDiagnosisSchema — biomarcadores pulmão/colorretal', () => {
  it('aceita egfrMutation: mutado/wild-type/indeterminado', () => {
    ['mutado', 'wild-type', 'indeterminado'].forEach((egfrMutation) => {
      expect(cancerDiagnosisSchema.safeParse({ ...base, egfrMutation }).success).toBe(true);
    });
  });

  it('rejeita egfrMutation inválido', () => {
    expect(cancerDiagnosisSchema.safeParse({ ...base, egfrMutation: 'desconhecido' }).success).toBe(false);
  });

  it('valida pdl1Expression entre 0 e 100', () => {
    expect(cancerDiagnosisSchema.safeParse({ ...base, pdl1Expression: 0 }).success).toBe(true);
    expect(cancerDiagnosisSchema.safeParse({ ...base, pdl1Expression: 50 }).success).toBe(true);
    expect(cancerDiagnosisSchema.safeParse({ ...base, pdl1Expression: 100 }).success).toBe(true);
  });

  it('rejeita pdl1Expression fora do range', () => {
    expect(cancerDiagnosisSchema.safeParse({ ...base, pdl1Expression: -1 }).success).toBe(false);
    expect(cancerDiagnosisSchema.safeParse({ ...base, pdl1Expression: 110 }).success).toBe(false);
  });

  it('aceita todos os valores válidos de msiStatus', () => {
    ['MSI-H', 'MSS', 'indeterminado'].forEach((msiStatus) => {
      expect(cancerDiagnosisSchema.safeParse({ ...base, msiStatus }).success).toBe(true);
    });
  });

  it('rejeita msiStatus inválido', () => {
    expect(cancerDiagnosisSchema.safeParse({ ...base, msiStatus: 'ALTA' }).success).toBe(false);
  });
});

describe('cancerDiagnosisSchema — biomarcadores próstata / marcadores tumorais', () => {
  it('aceita psaBaseline zero ou positivo', () => {
    expect(cancerDiagnosisSchema.safeParse({ ...base, psaBaseline: 0 }).success).toBe(true);
    expect(cancerDiagnosisSchema.safeParse({ ...base, psaBaseline: 4.5 }).success).toBe(true);
  });

  it('rejeita psaBaseline negativo', () => {
    expect(cancerDiagnosisSchema.safeParse({ ...base, psaBaseline: -1 }).success).toBe(false);
  });

  it('aceita ceaBaseline zero ou positivo', () => {
    expect(cancerDiagnosisSchema.safeParse({ ...base, ceaBaseline: 0 }).success).toBe(true);
    expect(cancerDiagnosisSchema.safeParse({ ...base, ceaBaseline: 12.3 }).success).toBe(true);
  });

  it('rejeita ceaBaseline negativo', () => {
    expect(cancerDiagnosisSchema.safeParse({ ...base, ceaBaseline: -0.1 }).success).toBe(false);
  });
});

describe('cancerDiagnosisSchema — metástase', () => {
  it('aceita primaryDiagnosisId como UUID válido', () => {
    const result = cancerDiagnosisSchema.safeParse({
      ...base,
      primaryDiagnosisId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita primaryDiagnosisId como string não-UUID', () => {
    const result = cancerDiagnosisSchema.safeParse({
      ...base,
      primaryDiagnosisId: 'nao-e-um-uuid',
    });
    expect(result.success).toBe(false);
  });
});
