import { useQuery } from '@tanstack/react-query';
import { observationsApi, Observation } from '@/lib/api/observations';
import {
  questionnaireResponsesApi,
  QuestionnaireResponse,
} from '@/lib/api/questionnaire-responses';

export type TimelineSymptomItem = {
  type: 'symptom';
  date: string;
} & Observation;

export type TimelineQuestionnaireItem = {
  type: 'questionnaire';
  date: string;
} & QuestionnaireResponse;

export type TimelineItem = TimelineSymptomItem | TimelineQuestionnaireItem;

export function usePatientTimeline(patientId: string | undefined) {
  const observationsQuery = useQuery({
    queryKey: ['observations', patientId],
    queryFn: () => observationsApi.getAll(patientId!),
    enabled: !!patientId,
    staleTime: 60 * 1000, // 1 min
  });

  const questionnaireResponsesQuery = useQuery({
    queryKey: ['questionnaire-responses', patientId],
    queryFn: () =>
      questionnaireResponsesApi.getAll(patientId, undefined, {
        limit: 100,
        offset: 0,
      }),
    enabled: !!patientId,
    staleTime: 60 * 1000, // 1 min
  });

  const timeline: TimelineItem[] = [];

  if (observationsQuery.data) {
    for (const obs of observationsQuery.data) {
      timeline.push({
        type: 'symptom',
        date: obs.effectiveDateTime,
        ...obs,
      });
    }
  }

  if (questionnaireResponsesQuery.data) {
    for (const qr of questionnaireResponsesQuery.data) {
      timeline.push({
        type: 'questionnaire',
        date: qr.completedAt,
        ...qr,
      });
    }
  }

  timeline.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return {
    timeline,
    isLoading:
      observationsQuery.isLoading || questionnaireResponsesQuery.isLoading,
    error: observationsQuery.error ?? questionnaireResponsesQuery.error,
    refetch: () => {
      observationsQuery.refetch();
      questionnaireResponsesQuery.refetch();
    },
  };
}
