"""Tool definitions para estruturação de evolução (structured output via generate_with_tools)."""

STRUCTURE_EVOLUTION_OUTPUT_TOOL = {
    "type": "function",
    "function": {
        "name": "structure_signed_evolution_output",
        "description": (
            "Devolve a extração estruturada da evolução assinada. "
            "Preencha apenas campos sustentados pelo texto; listas vazias quando não houver dados."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "clinical_exam_requests": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "display_name": {"type": "string"},
                            "code": {"type": ["string", "null"]},
                            "loinc_code": {"type": ["string", "null"]},
                        },
                        "required": ["display_name"],
                    },
                },
                "medications": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "dosage": {"type": ["string", "null"]},
                            "frequency": {"type": ["string", "null"]},
                            "indication": {"type": ["string", "null"]},
                            "route": {"type": ["string", "null"]},
                            "category": {"type": ["string", "null"]},
                            "notes": {"type": ["string", "null"]},
                        },
                        "required": ["name"],
                    },
                },
                "comorbidities": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "type": {"type": ["string", "null"]},
                            "severity": {"type": ["string", "null"]},
                            "controlled": {"type": ["boolean", "null"]},
                            "notes": {"type": ["string", "null"]},
                        },
                        "required": ["name"],
                    },
                },
                "patient_patch": {
                    "type": "object",
                    "properties": {
                        "cancerType": {"type": ["string", "null"]},
                        "stage": {"type": ["string", "null"]},
                        "performanceStatus": {"type": ["integer", "null"]},
                        "occupation": {"type": ["string", "null"]},
                        "preferredEmergencyHospital": {"type": ["string", "null"]},
                        "healthCoverageType": {"type": ["string", "null"]},
                        "healthPlanName": {"type": ["string", "null"]},
                        "insuranceMemberId": {"type": ["string", "null"]},
                        "currentSpecialty": {"type": ["string", "null"]},
                    },
                },
                "journey_patch": {"type": "object"},
                "diagnoses": {"type": "array", "items": {"type": "object"}},
                "treatments": {"type": "array", "items": {"type": "object"}},
                "navigation_step_updates": {
                    "type": "array",
                    "items": {"type": "object"},
                },
                "complementary_exams": {
                    "type": "array",
                    "items": {"type": "object"},
                },
                "observations": {"type": "array", "items": {"type": "object"}},
                "performance_status_history": {
                    "type": "array",
                    "items": {"type": "object"},
                },
                "clinical_prescription_lines": {
                    "type": "array",
                    "items": {"type": "object"},
                },
                "questionnaire_responses": {
                    "type": "array",
                    "items": {"type": "object"},
                },
                "rejection_report": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "domain": {"type": "string"},
                            "reason": {"type": "string"},
                            "field": {"type": ["string", "null"]},
                        },
                        "required": ["domain", "reason"],
                    },
                },
            },
            "required": [
                "clinical_exam_requests",
                "medications",
                "comorbidities",
                "patient_patch",
                "journey_patch",
                "diagnoses",
                "treatments",
                "navigation_step_updates",
                "complementary_exams",
                "observations",
                "performance_status_history",
                "clinical_prescription_lines",
                "questionnaire_responses",
                "rejection_report",
            ],
        },
    },
}

STRUCTURE_EVOLUTION_TOOLS = [STRUCTURE_EVOLUTION_OUTPUT_TOOL]
