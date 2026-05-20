import { describe, expect, it } from 'vitest';

import { skippedComplementaryExamsToastMessage } from '../exam-ingest-skipped-message';

describe('skippedComplementaryExamsToastMessage', () => {
  it('retorna string vazia quando não há itens ignorados', () => {
    expect(skippedComplementaryExamsToastMessage(0)).toBe('');
    expect(skippedComplementaryExamsToastMessage(-1)).toBe('');
  });

  it('descreve quantidade de exames ignorados', () => {
    expect(skippedComplementaryExamsToastMessage(2)).toContain('2');
    expect(skippedComplementaryExamsToastMessage(1)).toContain('dados inválidos');
  });
});
