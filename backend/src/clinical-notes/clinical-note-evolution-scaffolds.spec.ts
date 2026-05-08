import {
  ClinicalNoteType,
  JourneyStage,
  NavigationStepStatus,
} from '@generated/prisma/client';
import {
  baseNavigationStepKey,
  buildEvolutionSectionScaffolds,
  cancerTypeLabelPt,
} from './clinical-note-evolution-scaffolds';

describe('clinical-note-evolution-scaffolds', () => {
  it('baseNavigationStepKey removes numeric suffix', () => {
    expect(baseNavigationStepKey('intravesical_bcg')).toBe('intravesical_bcg');
    expect(baseNavigationStepKey('intravesical_bcg-2')).toBe('intravesical_bcg');
  });

  it('cancerTypeLabelPt maps known types', () => {
    expect(cancerTypeLabelPt('bladder')).toContain('bexiga');
    expect(cancerTypeLabelPt('unknown_x')).toBe('unknown_x');
    expect(cancerTypeLabelPt(null)).toBe('Não informado');
    expect(cancerTypeLabelPt('')).toBe('Não informado');
  });

  it('buildEvolutionSectionScaffolds adds MEDICAL narrative templates', () => {
    const { sections, examesComplementaresAppend } =
      buildEvolutionSectionScaffolds({
        cancerType: 'bladder',
        currentStage: JourneyStage.TREATMENT,
        noteType: ClinicalNoteType.MEDICAL,
        navigationSteps: [
          {
            id: 's1',
            stepKey: 'cystoscopy',
            stepName: 'Cistoscopia',
            status: NavigationStepStatus.PENDING,
            journeyStage: JourneyStage.TREATMENT,
            stepOrder: 1,
            notes: null,
            dueDate: null,
          },
        ],
        focusNavigationStepId: 's1',
      });
    expect(sections.hda?.trim()).toMatch(/^•\s*$/m);
    expect(sections.hda).not.toContain('História da doença atual');
    expect(sections.examesComplementares).toContain('• Lab');
    expect(sections.navegacao).toContain('Cistoscopia');
    expect(sections.navegacao).not.toContain('Foco clínico desta etapa');
    expect(examesComplementaresAppend).toBe('');
  });

  it('buildEvolutionSectionScaffolds uses NURSING templates', () => {
    const { sections } = buildEvolutionSectionScaffolds({
      cancerType: 'breast',
      currentStage: JourneyStage.DIAGNOSIS,
      noteType: ClinicalNoteType.NURSING,
      navigationSteps: [],
      focusNavigationStepId: null,
    });
    expect(sections.hda).toContain('Motivo do contato');
    expect(sections.hda).not.toContain('História de enfermagem');
    expect(sections.conduta).toContain('Educação em saúde e mediação');
  });
});
