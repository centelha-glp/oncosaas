import { BadRequestException } from '@nestjs/common';
import { PatientClinicalNotesController } from './patient-clinical-notes.controller';

describe('PatientClinicalNotesController', () => {
  const clinicalNotesService = {
    findAllForPatient: jest.fn(),
    create: jest.fn(),
    bootstrapEvolutionNavigationStep: jest.fn(),
  };
  const sectionSuggestionService = {
    getSectionSuggestions: jest.fn(),
  };

  const user = {
    id: 'user-1',
    email: 'user@example.com',
    tenantId: 'tenant-1',
    role: 'NURSE',
    clinicalSubrole: null,
  } as any;

  const PATIENT_ID = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('deve lançar BadRequestException quando navigationStepId for inválido', async () => {
      const controller = new PatientClinicalNotesController(
        clinicalNotesService as any,
        sectionSuggestionService as any
      );

      expect(() =>
        controller.findAll(PATIENT_ID, user, 1, 20, 'not-a-uuid')
      ).toThrow(BadRequestException);
      expect(clinicalNotesService.findAllForPatient).not.toHaveBeenCalled();
    });

    it('deve tratar navigationStepId vazio como undefined (sem filtro)', async () => {
      const controller = new PatientClinicalNotesController(
        clinicalNotesService as any,
        sectionSuggestionService as any
      );
      clinicalNotesService.findAllForPatient.mockResolvedValueOnce({ data: [], total: 0 });

      await controller.findAll(PATIENT_ID, user, 1, 20, '');

      expect(clinicalNotesService.findAllForPatient).toHaveBeenCalledWith(
        PATIENT_ID,
        user.tenantId,
        1,
        20,
        undefined
      );
    });

    it('deve repassar navigationStepId válido como filtro para o service', async () => {
      const controller = new PatientClinicalNotesController(
        clinicalNotesService as any,
        sectionSuggestionService as any
      );
      clinicalNotesService.findAllForPatient.mockResolvedValueOnce({ data: [], total: 0 });
      const stepId = '11111111-1111-4111-8111-111111111111';

      await controller.findAll(PATIENT_ID, user, 1, 20, stepId);

      expect(clinicalNotesService.findAllForPatient).toHaveBeenCalledWith(
        PATIENT_ID,
        user.tenantId,
        1,
        20,
        stepId
      );
    });
  });

  describe('bootstrapEvolutionNavigationStep', () => {
    it('deve repassar tenantId, actor e noteType ao service', async () => {
      const controller = new PatientClinicalNotesController(
        clinicalNotesService as any,
        sectionSuggestionService as any
      );
      clinicalNotesService.bootstrapEvolutionNavigationStep.mockResolvedValueOnce({
        id: 'step-new',
      });

      const out = await controller.bootstrapEvolutionNavigationStep(
        PATIENT_ID,
        { noteType: 'NURSING' as any },
        user
      );

      expect(out).toEqual({ id: 'step-new' });
      expect(clinicalNotesService.bootstrapEvolutionNavigationStep).toHaveBeenCalledWith(
        PATIENT_ID,
        user.tenantId,
        expect.objectContaining({
          id: user.id,
          role: user.role,
          clinicalSubrole: user.clinicalSubrole,
        }),
        'NURSING'
      );
    });
  });
});

