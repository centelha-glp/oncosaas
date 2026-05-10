import {
  decodeDecryptedClinicalNoteToMarkdown,
  sectionsRecordToMarkdown,
} from './clinical-note-legacy-content.util';

describe('sectionsRecordToMarkdown', () => {
  it('monta Markdown com títulos e separadores', () => {
    const md = sectionsRecordToMarkdown({
      hda: 'Queixa',
      conduta: 'Observar',
    });
    expect(md).toContain('## HDA');
    expect(md).toContain('Queixa');
    expect(md).toContain('## Conduta');
    expect(md).toContain('Observar');
    expect(md).not.toContain('\n---\n');
  });
});

describe('decodeDecryptedClinicalNoteToMarkdown', () => {
  it('devolve texto que não é JSON de seções', () => {
    expect(decodeDecryptedClinicalNoteToMarkdown('Texto livre')).toBe(
      'Texto livre'
    );
  });

  it('converte JSON legado de seções em Markdown', () => {
    const json = JSON.stringify({ hda: 'História', planos: 'Seguimento' });
    const md = decodeDecryptedClinicalNoteToMarkdown(json);
    expect(md).toContain('## HDA');
    expect(md).toContain('História');
    expect(md).toContain('## Planos');
    expect(md).toContain('Seguimento');
  });

  it('não trata JSON arbitrário como seções', () => {
    const t = decodeDecryptedClinicalNoteToMarkdown('{"foo":"bar"}');
    expect(t).toBe('{"foo":"bar"}');
  });
});
