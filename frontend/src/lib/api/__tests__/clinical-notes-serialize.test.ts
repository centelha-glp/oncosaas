import { describe, expect, it } from 'vitest';
import {
  cloneClinicalNoteSections,
  mergeClinicalSectionsWithCadastroSuggestions,
  serializeClinicalNoteSections,
} from '../clinical-notes';

describe('serializeClinicalNoteSections', () => {
  it('usa ordem fixa de chaves (comparação estável para autosave)', () => {
    const a = serializeClinicalNoteSections({ planos: 'x', hda: 'y' });
    const b = serializeClinicalNoteSections({ hda: 'y', planos: 'x' });
    expect(a).toBe(b);
  });
});

describe('cloneClinicalNoteSections', () => {
  it('preenche todas as chaves do protocolo', () => {
    const c = cloneClinicalNoteSections({ hda: 'texto' });
    expect(c.hda).toBe('texto');
    expect(c.planos).toBe('');
  });
});

describe('mergeClinicalSectionsWithCadastroSuggestions', () => {
  it('preenche apenas chaves vazias', () => {
    const prev = cloneClinicalNoteSections({ hda: 'já preenchido' });
    const sug = cloneClinicalNoteSections({
      identificacao: 'sugestão id',
      hda: 'não deve sobrescrever',
    });
    const m = mergeClinicalSectionsWithCadastroSuggestions(prev, sug);
    expect(m.hda).toBe('já preenchido');
    expect(m.identificacao).toBe('sugestão id');
  });
});
