import {
  mergeMarkdownWithCadastroSuggestion,
} from '../clinical-notes';

describe('mergeMarkdownWithCadastroSuggestion', () => {
  it('usa só a sugestão quando a evolução anterior está vazia', () => {
    expect(mergeMarkdownWithCadastroSuggestion('', '## HDA\n\ntexto')).toBe(
      '## HDA\n\ntexto'
    );
  });

  it('mantém só o anterior quando a sugestão está vazia', () => {
    expect(mergeMarkdownWithCadastroSuggestion('já tenho texto', '')).toBe(
      'já tenho texto'
    );
  });

  it('concatena com separador quando ambos têm conteúdo', () => {
    const m = mergeMarkdownWithCadastroSuggestion('A', 'B');
    expect(m).toContain('A');
    expect(m).toContain('B');
    expect(m).toContain('---');
  });
});
