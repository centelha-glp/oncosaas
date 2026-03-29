import { describe, it, expect } from 'vitest';
import { createPatientSchema } from '../patient';

// Dados mínimos válidos para um paciente em Rastreamento
const base = {
  name: 'Maria Silva',
  birthDate: '1980-06-15',
  phone: '11987654321',
  currentStage: 'SCREENING' as const,
};

// Dados completos para paciente em Tratamento
const treatmentBase = {
  ...base,
  currentStage: 'TREATMENT' as const,
  cancerType: 'bladder' as const,
  diagnosisDate: '2023-08-01',
  stage: 'T2N0M0',
  performanceStatus: 1,
  currentTreatment: 'Quimioterapia com Cisplatina',
};

describe('createPatientSchema — campos básicos', () => {
  it('aceita dados mínimos válidos (SCREENING)', () => {
    expect(createPatientSchema.safeParse(base).success).toBe(true);
  });

  it('rejeita nome com menos de 2 caracteres', () => {
    const result = createPatientSchema.safeParse({ ...base, name: 'A' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain('2 caracteres');
  });

  it('rejeita nome vazio', () => {
    expect(createPatientSchema.safeParse({ ...base, name: '' }).success).toBe(false);
  });

  it('rejeita birthDate ausente', () => {
    const result = createPatientSchema.safeParse({ ...base, birthDate: '' });
    expect(result.success).toBe(false);
  });

  it('rejeita telefone com menos de 10 dígitos', () => {
    const result = createPatientSchema.safeParse({ ...base, phone: '1199999' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain('10 dígitos');
  });

  it('aceita telefone com exatamente 10 dígitos', () => {
    expect(createPatientSchema.safeParse({ ...base, phone: '1199999999' }).success).toBe(true);
  });

  it('rejeita email inválido', () => {
    const result = createPatientSchema.safeParse({ ...base, email: 'nao-e-email' });
    expect(result.success).toBe(false);
  });

  it('aceita email vazio (campo opcional)', () => {
    expect(createPatientSchema.safeParse({ ...base, email: '' }).success).toBe(true);
  });

  it('aceita email válido', () => {
    expect(createPatientSchema.safeParse({ ...base, email: 'maria@hospital.com' }).success).toBe(true);
  });

  it('currentStage padrão é SCREENING quando não informado', () => {
    const result = createPatientSchema.safeParse({ name: 'João', birthDate: '1990-01-01', phone: '11999999999' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currentStage).toBe('SCREENING');
    }
  });
});

describe('createPatientSchema — ECOG (performanceStatus)', () => {
  it('aceita ECOG 0 a 4', () => {
    [0, 1, 2, 3, 4].forEach((ps) => {
      const result = createPatientSchema.safeParse({ ...base, performanceStatus: ps });
      expect(result.success, `ECOG ${ps} deveria ser aceito`).toBe(true);
    });
  });

  it('rejeita ECOG maior que 4', () => {
    const result = createPatientSchema.safeParse({ ...base, performanceStatus: 5 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain('ECOG deve ser entre 0 e 4');
  });

  it('aceita performanceStatus ausente (campo opcional para SCREENING)', () => {
    expect(createPatientSchema.safeParse(base).success).toBe(true);
  });
});

describe('createPatientSchema — validações cruzadas para TREATMENT', () => {
  it('aceita paciente em tratamento com todos os campos obrigatórios', () => {
    expect(createPatientSchema.safeParse(treatmentBase).success).toBe(true);
  });

  it('rejeita TREATMENT sem cancerType', () => {
    const { cancerType, ...rest } = treatmentBase;
    const result = createPatientSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejeita TREATMENT sem diagnosisDate', () => {
    const result = createPatientSchema.safeParse({ ...treatmentBase, diagnosisDate: '' });
    expect(result.success).toBe(false);
  });

  it('rejeita TREATMENT sem stage (TNM)', () => {
    const result = createPatientSchema.safeParse({ ...treatmentBase, stage: '' });
    expect(result.success).toBe(false);
  });

  it('rejeita TREATMENT sem performanceStatus', () => {
    const { performanceStatus, ...rest } = treatmentBase;
    const result = createPatientSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejeita TREATMENT sem currentTreatment', () => {
    const result = createPatientSchema.safeParse({ ...treatmentBase, currentTreatment: '' });
    expect(result.success).toBe(false);
  });

  it('rejeita FOLLOW_UP sem campos de diagnóstico', () => {
    const result = createPatientSchema.safeParse({ ...base, currentStage: 'FOLLOW_UP' });
    expect(result.success).toBe(false);
  });

  it('aceita FOLLOW_UP com todos os campos obrigatórios', () => {
    const followUp = { ...treatmentBase, currentStage: 'FOLLOW_UP' as const };
    expect(createPatientSchema.safeParse(followUp).success).toBe(true);
  });

  it('aceita DIAGNOSIS sem campos de diagnóstico (validação não se aplica)', () => {
    const result = createPatientSchema.safeParse({ ...base, currentStage: 'DIAGNOSIS' });
    expect(result.success).toBe(true);
  });
});

describe('createPatientSchema — campos TNM opcionais', () => {
  it('aceita tStage válido', () => {
    (['T1', 'T2', 'T3', 'T4', 'Tis', 'Tx'] as const).forEach((tStage) => {
      const result = createPatientSchema.safeParse({ ...base, tStage });
      expect(result.success, `tStage ${tStage} deveria ser aceito`).toBe(true);
    });
  });

  it('rejeita tStage inválido', () => {
    expect(createPatientSchema.safeParse({ ...base, tStage: 'T9' as never }).success).toBe(false);
  });

  it('aceita nStage válido', () => {
    (['N0', 'N1', 'N2', 'N3', 'Nx'] as const).forEach((nStage) => {
      expect(createPatientSchema.safeParse({ ...base, nStage }).success).toBe(true);
    });
  });

  it('aceita mStage válido', () => {
    (['M0', 'M1', 'Mx'] as const).forEach((mStage) => {
      expect(createPatientSchema.safeParse({ ...base, mStage }).success).toBe(true);
    });
  });
});
