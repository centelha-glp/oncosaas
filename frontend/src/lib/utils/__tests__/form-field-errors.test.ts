import { describe, it, expect } from 'vitest';
import { editPatientSchema } from '@/lib/validations/patient';
import {
  collectAllFormErrorMessages,
  messagesFromZodError,
} from '../form-field-errors';

describe('collectAllFormErrorMessages', () => {
  it('expande vários "Required" do Zod em mensagens por campo', () => {
    const errs = {
      name: { type: 'invalid_type', message: 'Required' },
      birthDate: { type: 'invalid_type', message: 'Required' },
    };
    const msgs = collectAllFormErrorMessages(errs);
    expect(msgs).toContain('Nome completo: preenchimento obrigatório');
    expect(msgs).toContain('Data de nascimento: preenchimento obrigatório');
    expect(msgs.length).toBe(2);
  });

  it('preserva mensagens customizadas do Zod', () => {
    const errs = {
      email: { type: 'custom', message: 'Email inválido' },
    };
    expect(collectAllFormErrorMessages(errs)).toEqual(['Email inválido']);
  });
});

describe('messagesFromZodError', () => {
  it('lista um item por issue do Zod (núcleo oncológico)', () => {
    const parsed = editPatientSchema.safeParse({
      name: 'Maria Silva',
      birthDate: '1980-06-15',
      phone: '',
      email: '',
      currentStage: 'DIAGNOSIS',
      cancerType: undefined,
      diagnosisDate: '',
      stage: '',
      performanceStatus: undefined,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const msgs = messagesFromZodError(parsed.error);
      expect(msgs.length).toBeGreaterThanOrEqual(3);
      expect(msgs.some((m) => /tipo de câncer/i.test(m))).toBe(true);
      expect(msgs.some((m) => /diagnóstico/i.test(m))).toBe(true);
    }
  });
});
