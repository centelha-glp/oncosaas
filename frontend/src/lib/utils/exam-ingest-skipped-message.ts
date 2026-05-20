/**
 * Mensagem de toast quando itens de complementary exams foram ignorados na extração.
 */
export function skippedComplementaryExamsToastMessage(skippedCount: number): string {
  if (skippedCount <= 0) {
    return '';
  }
  return `${skippedCount} exame(s) estruturado(s) ignorado(s) por dados inválidos. Revise o laudo na evolução.`;
}
