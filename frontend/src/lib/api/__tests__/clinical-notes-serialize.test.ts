import {
  mergeMarkdownWithCadastroSuggestion,
} from '../clinical-notes';

describe('mergeMarkdownWithCadastroSuggestion', () => {
  it('usa só a sugestão quando a evolução anterior está vazia', () => {
    expect(mergeMarkdownWithCadastroSuggestion('', '## HDA\n\ntexto')).toBe(
      '## HDA\n\ntexto'
    );
  });

  it('usa a sugestão quando o anterior é só espaços em branco', () => {
    expect(mergeMarkdownWithCadastroSuggestion('   \n', 'sugestão')).toBe(
      'sugestão'
    );
  });

  it('mantém só o anterior quando a sugestão está vazia', () => {
    expect(mergeMarkdownWithCadastroSuggestion('já tenho texto', '')).toBe(
      'já tenho texto'
    );
  });

  it('prioriza a evolução anterior quando ambos têm conteúdo (não concatena)', () => {
    expect(mergeMarkdownWithCadastroSuggestion('A', 'B')).toBe('A');
  });
});
