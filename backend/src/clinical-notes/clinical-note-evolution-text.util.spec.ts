import {
  normalizeEvolutionLine,
  normalizeEvolutionSectionBody,
} from './clinical-note-evolution-text.util';

describe('clinical-note-evolution-text.util', () => {
  it('normalizeEvolutionLine remove rótulo quando há valor após dois-pontos', () => {
    expect(normalizeEvolutionLine('Paciente: João Silva')).toBe('João Silva');
    expect(normalizeEvolutionLine('• Paciente: João')).toBe('• João');
  });

  it('normalizeEvolutionLine mantém linha-guia que termina em dois-pontos sem valor', () => {
    expect(normalizeEvolutionLine('• Motivo do atendimento:')).toBe(
      '• Motivo do atendimento:'
    );
    expect(normalizeEvolutionLine('Conduta médica:')).toBe('Conduta médica:');
  });

  it('normalizeEvolutionLine não corta quando o dois-pontos vem após ) (exames com data)', () => {
    const line = '• Hemograma (08/05/2026): 12 g/dL';
    expect(normalizeEvolutionLine(line)).toBe(line);
  });

  it('normalizeEvolutionLine preserva indentação e bullet', () => {
    expect(normalizeEvolutionLine('  Tabagismo: Ex-fumante')).toBe(
      '  Ex-fumante'
    );
  });

  it('normalizeEvolutionSectionBody processa múltiplas linhas', () => {
    const md = ['Paciente: A', 'Idade: 40 anos', '', '• item:'].join('\n');
    expect(normalizeEvolutionSectionBody(md)).toBe(
      ['A', '40 anos', '', '• item:'].join('\n')
    );
  });

  it('primeiro dois-pontos em linha tipo tratamento remove contexto (por isso tratamentos não é normalizado no serviço)', () => {
    const line = '• Quimioterapia — bexiga — Início: 01/01/2025 — Ativo';
    expect(normalizeEvolutionLine(line)).toBe('• 01/01/2025 — Ativo');
  });
});
