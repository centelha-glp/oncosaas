"""Tools para structured output do pipeline suggest-orders (4 passos)."""

EXAM_CONTEXT_TOOL_NAME = "exam_context_output"
EXAM_GENERATE_TOOL_NAME = "exam_generate_output"
RX_CONTEXT_TOOL_NAME = "rx_context_output"
RX_GENERATE_TOOL_NAME = "rx_generate_output"

_REJECTION_REPORT_SCHEMA = {
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
}

_EXPLICIT_ORDER_SCHEMA = {
    "type": "object",
    "properties": {
        "display_name": {"type": "string"},
        "evidence_quote": {"type": "string"},
        "order_kind": {
            "type": "string",
            "enum": ["panel", "single"],
        },
    },
    "required": ["display_name", "evidence_quote"],
}

_EXAM_RESULT_SCHEMA = {
    "type": "object",
    "properties": {
        "display_name": {"type": "string"},
        "value_summary": {"type": ["string", "null"]},
        "performed_at": {"type": ["string", "null"]},
        "evidence_quote": {"type": "string"},
        "is_prior_result": {"type": "boolean"},
    },
    "required": ["display_name", "evidence_quote", "is_prior_result"],
}

_THERAPY_REVIEW_SCHEMA = {
    "type": "object",
    "properties": {
        "medication_name": {"type": "string"},
        "issue_type": {
            "type": "string",
            "enum": [
                "inconsistency",
                "incomplete",
                "suboptimal",
                "disease_mismatch",
                "comorbidity_risk",
                "duplicate_therapy",
                "allergy_risk",
            ],
        },
        "recommended_intent": {
            "type": "string",
            "enum": ["PRESCRIBE_NEW", "ADJUST_DOSE", "SUSPEND"],
        },
        "proposed_dosage": {"type": ["string", "null"]},
        "proposed_frequency": {"type": ["string", "null"]},
        "proposed_route": {"type": ["string", "null"]},
        "rationale": {"type": "string"},
        "linked_context": {"type": ["string", "null"]},
    },
    "required": [
        "medication_name",
        "issue_type",
        "recommended_intent",
        "rationale",
    ],
}

EXAM_CONTEXT_OUTPUT_TOOL = {
    "type": "function",
    "function": {
        "name": EXAM_CONTEXT_TOOL_NAME,
        "description": "Contexto do trilho de exames (passo 1A) para suggest-orders.",
        "parameters": {
            "type": "object",
            "properties": {
                "exam_context_schema_version": {"type": "string"},
                "exam_results_documented": {
                    "type": "array",
                    "items": _EXAM_RESULT_SCHEMA,
                },
                "explicit_orders_documented": {
                    "type": "array",
                    "items": _EXPLICIT_ORDER_SCHEMA,
                },
                "monitoring_gaps": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "description": {"type": "string"},
                            "linked_signal": {"type": ["string", "null"]},
                        },
                        "required": ["description"],
                    },
                },
                "clinical_signals_for_exams": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "signal": {"type": "string"},
                            "source": {
                                "type": "string",
                                "enum": ["text", "snapshot", "both"],
                            },
                        },
                        "required": ["signal", "source"],
                    },
                },
                "sections_excerpt": {"type": "object"},
                "flags": {"type": "object"},
                "rejection_report": _REJECTION_REPORT_SCHEMA,
            },
            "required": [
                "exam_context_schema_version",
                "exam_results_documented",
                "explicit_orders_documented",
                "monitoring_gaps",
                "clinical_signals_for_exams",
                "sections_excerpt",
                "flags",
                "rejection_report",
            ],
        },
    },
}

EXAM_GENERATE_OUTPUT_TOOL = {
    "type": "function",
    "function": {
        "name": EXAM_GENERATE_TOOL_NAME,
        "description": "Pedidos de exame (passo 2A) para revisão humana.",
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
                            "request_source": {
                                "type": "string",
                                "enum": ["explicit", "contextual"],
                            },
                            "rationale": {"type": ["string", "null"]},
                        },
                        "required": ["display_name", "request_source"],
                    },
                },
                "rejection_report": _REJECTION_REPORT_SCHEMA,
            },
            "required": ["clinical_exam_requests", "rejection_report"],
        },
    },
}

RX_CONTEXT_OUTPUT_TOOL = {
    "type": "function",
    "function": {
        "name": RX_CONTEXT_TOOL_NAME,
        "description": "Contexto do trilho de prescrição (passo 1B) para suggest-orders.",
        "parameters": {
            "type": "object",
            "properties": {
                "rx_context_schema_version": {"type": "string"},
                "medications_in_use": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "dosage": {"type": ["string", "null"]},
                            "frequency": {"type": ["string", "null"]},
                            "route": {"type": ["string", "null"]},
                            "matches_snapshot_id": {"type": ["string", "null"]},
                        },
                        "required": ["name"],
                    },
                },
                "conduct_prescription_intents": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "intent": {
                                "type": "string",
                                "enum": [
                                    "PRESCRIBE_NEW",
                                    "ADJUST_DOSE",
                                    "SUSPEND",
                                    "MONITOR",
                                    "OTHER",
                                ],
                            },
                            "medication_name": {"type": "string"},
                            "proposed_dosage": {"type": ["string", "null"]},
                            "proposed_frequency": {"type": ["string", "null"]},
                            "proposed_route": {"type": ["string", "null"]},
                            "proposed_duration": {"type": ["string", "null"]},
                            "evidence_quote": {"type": "string"},
                        },
                        "required": ["intent", "medication_name", "evidence_quote"],
                    },
                },
                "therapy_review_suggestions": {
                    "type": "array",
                    "items": _THERAPY_REVIEW_SCHEMA,
                },
                "sections_excerpt": {"type": "object"},
                "flags": {"type": "object"},
                "rejection_report": _REJECTION_REPORT_SCHEMA,
            },
            "required": [
                "rx_context_schema_version",
                "medications_in_use",
                "conduct_prescription_intents",
                "therapy_review_suggestions",
                "sections_excerpt",
                "flags",
                "rejection_report",
            ],
        },
    },
}

RX_GENERATE_OUTPUT_TOOL = {
    "type": "function",
    "function": {
        "name": RX_GENERATE_TOOL_NAME,
        "description": "Linhas de receita (passo 2B) para revisão humana.",
        "parameters": {
            "type": "object",
            "properties": {
                "clinical_prescription_lines": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "medication_name": {"type": "string"},
                            "catalog_key": {"type": ["string", "null"]},
                            "dosage": {"type": ["string", "null"]},
                            "frequency": {"type": ["string", "null"]},
                            "route": {"type": ["string", "null"]},
                            "duration": {"type": ["string", "null"]},
                            "indication": {"type": ["string", "null"]},
                            "prescription_intent": {
                                "type": "string",
                                "enum": ["NEW", "DOSE_CHANGE", "SUSPEND"],
                            },
                        },
                        "required": ["medication_name", "prescription_intent"],
                    },
                },
                "rejection_report": _REJECTION_REPORT_SCHEMA,
            },
            "required": ["clinical_prescription_lines", "rejection_report"],
        },
    },
}

ORDER_STEP_TOOLS: dict[str, list[dict]] = {
    EXAM_CONTEXT_TOOL_NAME: [EXAM_CONTEXT_OUTPUT_TOOL],
    EXAM_GENERATE_TOOL_NAME: [EXAM_GENERATE_OUTPUT_TOOL],
    RX_CONTEXT_TOOL_NAME: [RX_CONTEXT_OUTPUT_TOOL],
    RX_GENERATE_TOOL_NAME: [RX_GENERATE_OUTPUT_TOOL],
}
