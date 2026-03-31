import { Injectable } from '@nestjs/common';
import { Observation, Patient, Prisma } from '@generated/prisma/client';
import {
  FHIRPatient,
  FHIRObservation,
} from '../interfaces/fhir-resource.interface';

@Injectable()
export class FHIRTransformerService {
  /**
   * Transformar Patient interno para FHIR Patient Resource
   */
  toFHIRPatient(patient: Patient): FHIRPatient {
    return {
      resourceType: 'Patient',
      id: patient.ehrPatientId || undefined,
      identifier: patient.cpf
        ? [
            {
              system: 'http://www.brazil.gov.br/cpf',
              value: patient.cpf,
            },
          ]
        : undefined,
      name: patient.name
        ? [
            {
              text: patient.name,
              // Tentar separar nome e sobrenome
              family: this.extractFamilyName(patient.name),
              given: this.extractGivenNames(patient.name),
            },
          ]
        : undefined,
      birthDate: patient.birthDate
        ? patient.birthDate.toISOString().split('T')[0]
        : undefined,
      gender: patient.gender as 'male' | 'female' | 'other' | undefined,
      telecom: [
        ...(patient.phone
          ? [
              {
                system: 'phone' as const,
                value: patient.phone,
              },
            ]
          : []),
        ...(patient.email
          ? [
              {
                system: 'email' as const,
                value: patient.email,
              },
            ]
          : []),
      ],
    };
  }

  /**
   * Transformar FHIR Patient Resource para Patient interno
   */
  fromFHIRPatient(fhirPatient: FHIRPatient): Partial<Patient> {
    const name =
      fhirPatient.name?.[0]?.text ||
      (
        fhirPatient.name?.[0]?.given?.join(' ') +
        ' ' +
        fhirPatient.name?.[0]?.family
      ).trim();

    const cpf = fhirPatient.identifier?.find(
      (id) => id.system === 'http://www.brazil.gov.br/cpf'
    )?.value;

    const phone = fhirPatient.telecom?.find((t) => t.system === 'phone')?.value;

    const email = fhirPatient.telecom?.find((t) => t.system === 'email')?.value;

    return {
      name: name || undefined,
      cpf: cpf || undefined,
      birthDate: fhirPatient.birthDate
        ? new Date(fhirPatient.birthDate)
        : undefined,
      gender: fhirPatient.gender || undefined,
      phone: phone || undefined,
      email: email || undefined,
      ehrPatientId: fhirPatient.id || undefined,
    };
  }

  /**
   * Transformar Observation interna para FHIR Observation Resource
   */
  toFHIRObservation(
    observation: Observation & { patient?: { ehrPatientId?: string | null } }
  ): FHIRObservation {
    const patientReference = observation.patient?.ehrPatientId
      ? `Patient/${observation.patient.ehrPatientId}`
      : `Patient/${observation.patientId}`;

    const fhirObservation: FHIRObservation = {
      resourceType: 'Observation',
      id: observation.fhirResourceId || undefined,
      status: (observation.status as FHIRObservation['status']) || 'final',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: observation.code,
            display: observation.display,
          },
        ],
        text: observation.display,
      },
      subject: {
        reference: patientReference,
      },
      effectiveDateTime: observation.effectiveDateTime.toISOString(),
    };

    // Adicionar valor conforme tipo
    if (
      observation.valueQuantity !== null &&
      observation.valueQuantity !== undefined
    ) {
      fhirObservation.valueQuantity = {
        value: Number(observation.valueQuantity),
        unit: observation.unit || undefined,
        system: 'http://unitsofmeasure.org',
      };
    } else if (observation.valueString) {
      fhirObservation.valueString = observation.valueString;
    }

    return fhirObservation;
  }

  /**
   * Transformar FHIR Observation Resource para Observation interna
   */
  fromFHIRObservation(
    fhirObservation: FHIRObservation,
    tenantId: string,
    patientId: string
  ): Partial<Observation> {
    const loincCode = fhirObservation.code.coding.find(
      (c) => c.system === 'http://loinc.org'
    );

    let valueQuantity: number | null = null;
    let valueString: string | null = null;

    if (fhirObservation.valueQuantity) {
      valueQuantity = fhirObservation.valueQuantity.value;
    } else if (fhirObservation.valueString) {
      valueString = fhirObservation.valueString;
    }

    return {
      tenantId,
      patientId,
      code: loincCode?.code || '',
      display: loincCode?.display || fhirObservation.code.text || '',
      valueQuantity:
        valueQuantity !== null ? new Prisma.Decimal(valueQuantity) : undefined,
      valueString: valueString || undefined,
      unit: fhirObservation.valueQuantity?.unit || undefined,
      effectiveDateTime: new Date(fhirObservation.effectiveDateTime),
      status: fhirObservation.status,
      fhirResourceId: fhirObservation.id || undefined,
      syncedToEHR: !!fhirObservation.id,
      syncedAt: fhirObservation.id ? new Date() : undefined,
    };
  }

  /**
   * Extrair sobrenome do nome completo
   */
  private extractFamilyName(fullName: string): string {
    const parts = fullName.trim().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  /**
   * Extrair nomes próprios (tudo exceto último sobrenome)
   */
  private extractGivenNames(fullName: string): string[] {
    const parts = fullName.trim().split(/\s+/);
    return parts.length > 1 ? parts.slice(0, -1) : parts;
  }
}
