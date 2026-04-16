'use client';

import React from 'react';
import { PatientDetail } from '@/lib/api/patients';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PatientOverviewTab } from './patient-overview-tab';
import { PatientOncologyTab } from './patient-oncology-tab';
import { PatientClinicalTab } from './patient-clinical-tab';
import { PatientTreatmentTab } from './patient-treatment-tab';
import { PatientNavigationTab } from './patient-navigation-tab';
import { PatientProntuarioTab } from './patient-prontuario-tab';

const TAB_VALUES = [
  'overview',
  'clinical',
  'oncology',
  'treatment',
  'navigation',
  'chart',
] as const;

interface PatientDetailTabsProps {
  patient: PatientDetail;
  /** Ex.: `chart` quando a URL traz `?tab=chart` (link da navegação oncológica → prontuário). */
  defaultTab?: (typeof TAB_VALUES)[number];
}

export function PatientDetailTabs({
  patient,
  defaultTab = 'overview',
}: PatientDetailTabsProps): React.ReactElement {
  const initial =
    defaultTab && TAB_VALUES.includes(defaultTab) ? defaultTab : 'overview';
  return (
    <Tabs defaultValue={initial} className="w-full">
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1 h-auto">
        <TabsTrigger value="overview">Visão Geral</TabsTrigger>
        <TabsTrigger value="clinical">Dados Clínicos</TabsTrigger>
        <TabsTrigger value="oncology">Dados Oncológicos</TabsTrigger>
        <TabsTrigger value="treatment">Tratamento</TabsTrigger>
        <TabsTrigger value="navigation">Navegação</TabsTrigger>
        <TabsTrigger value="chart">Prontuário</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-6">
        <PatientOverviewTab patient={patient} />
      </TabsContent>

      <TabsContent value="clinical" className="mt-6">
        <PatientClinicalTab patient={patient} />
      </TabsContent>

      <TabsContent value="oncology" className="mt-6">
        <PatientOncologyTab patient={patient} />
      </TabsContent>

      <TabsContent value="treatment" className="mt-6">
        <PatientTreatmentTab patient={patient} />
      </TabsContent>

      <TabsContent value="navigation" className="mt-6">
        <PatientNavigationTab patient={patient} />
      </TabsContent>

      <TabsContent value="chart" className="mt-6">
        <PatientProntuarioTab patient={patient} />
      </TabsContent>
    </Tabs>
  );
}
