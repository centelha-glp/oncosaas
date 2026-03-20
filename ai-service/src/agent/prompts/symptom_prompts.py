"""
Prompts for LLM-based symptom analysis.
"""


SYMPTOM_ANALYSIS_PROMPT = """Analise a mensagem do paciente oncológico e extraia informações sobre sintomas.

Para cada sintoma detectado, forneça:
1. nome: Nome do sintoma em português
2. severity: Classificação (LOW, MEDIUM, HIGH, CRITICAL)
3. confidence: Confiança na detecção (0.0 a 1.0)
4. details: Detalhes extraídos (intensidade, duração, localização)

Considere o contexto clínico do paciente ao avaliar a severidade:
- Paciente em quimioterapia com febre = potencial febre neutropênica (CRITICAL)
- Dor acima de 7/10 = HIGH ou CRITICAL dependendo do controle
- Sangramento em paciente com trombocitopenia = CRITICAL

Retorne APENAS o JSON estruturado, sem texto adicional."""


SYMPTOM_ANALYSIS_TOOLS = [
    {
        "name": "analyze_symptoms",
        "description": "Extract and classify symptoms from a patient message",
        "input_schema": {
            "type": "object",
            "properties": {
                "symptoms": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "Symptom name in Portuguese",
                            },
                            "severity": {
                                "type": "string",
                                "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
                                "description": "Severity classification",
                            },
                            "confidence": {
                                "type": "number",
                                "description": "Detection confidence (0-1)",
                            },
                            "details": {
                                "type": "object",
                                "properties": {
                                    "intensity": {
                                        "type": "string",
                                        "description": "Intensity level or score",
                                    },
                                    "duration": {
                                        "type": "string",
                                        "description": "How long symptom has lasted",
                                    },
                                    "location": {
                                        "type": "string",
                                        "description": "Body location if applicable",
                                    },
                                },
                            },
                        },
                        "required": ["name", "severity", "confidence"],
                    },
                },
                "overall_severity": {
                    "type": "string",
                    "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
                    "description": "Overall severity assessment",
                },
                "requires_escalation": {
                    "type": "boolean",
                    "description": "Whether immediate nursing escalation is needed",
                },
                "escalation_reason": {
                    "type": "string",
                    "description": "Reason for escalation if required",
                },
            },
            "required": ["symptoms", "overall_severity", "requires_escalation"],
        },
    }
]
