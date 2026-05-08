import { apiClient } from '@/lib/api/client';

export type TissSpsadtGuideItem = {
  id: string;
  procedureName: string;
  procedureCode: string | null;
  quantity: number;
  notes: string | null;
  examRequestId: string;
};

export type TissSpsadtGuide = {
  id: string;
  guideNumber: string;
  operatorName: string;
  operatorANSCode: string | null;
  beneficiaryName: string;
  beneficiaryCardNumber: string | null;
  requestingProfessionalName: string;
  requestingProfessionalCouncil: string | null;
  requestingProfessionalCouncilUf: string | null;
  requestingProfessionalRegistration: string | null;
  requestingFacilityCnes: string | null;
  createdAt: string;
  patient: { id: string; name: string };
  items: TissSpsadtGuideItem[];
};

export const tissGuidesApi = {
  emitSpsadtGuide(
    patientId: string,
    clinicalNoteId: string,
    body: {
      operatorName: string;
      operatorANSCode?: string;
      beneficiaryName?: string;
      beneficiaryCardNumber?: string;
      requestingProfessionalName?: string;
      requestingProfessionalCouncil?: string;
      requestingProfessionalCouncilUf?: string;
      requestingProfessionalRegistration?: string;
      requestingFacilityCnes?: string;
    }
  ): Promise<TissSpsadtGuide> {
    return apiClient.post(
      `/patients/${patientId}/clinical-notes/${clinicalNoteId}/tiss/sp-sadt`,
      body
    );
  },

  getSpsadtGuide(guideId: string): Promise<TissSpsadtGuide> {
    return apiClient.get(`/tiss/sp-sadt/${guideId}`);
  },
};

