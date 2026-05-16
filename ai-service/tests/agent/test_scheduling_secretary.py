"""
Tests for SchedulingSecretaryAgent and orchestrator scheduling tool parser.

Cobre:
- subagente expõe as 4 tools de mutação + a tool read-only de consulta de vagas
- ORCHESTRATOR_ROUTING_TOOLS inclui `consultar_agente_secretaria`
- parser do orchestrator gera as 4 actions/decisions corretas
- parser emite CHECK_CONSULTATION_AVAILABILITY sem exigir confirmação
- payload de vagas incompleto NÃO gera ação (decisão de coleta)
- payload incompleto NÃO gera ação para mutações
- ausência de confirmacao_paciente NÃO gera ação (mutações)
- patientId xor patientIntake para criar_consulta
- dedupe de actions de agenda (mutações idênticas vs vagas com ranges distintos)
"""

from src.agent.orchestrator import orchestrator
from src.agent.prompts.action_tools import AGENT_ACTION_TOOLS
from src.agent.prompts.orchestrator_prompt import ORCHESTRATOR_ROUTING_TOOLS
from src.agent.subagents import (
    SchedulingSecretaryAgent,
    NavigationAgent,
)


def _names(tools):
    return {t["name"] for t in tools}


def test_scheduling_secretary_exposes_appointment_and_availability_tools():
    agent = SchedulingSecretaryAgent()
    tool_names = _names(agent.tools)
    assert tool_names == {
        "listar_profissionais_consulta",
        "consultar_vagas_consulta",
        "criar_consulta",
        "reagendar_consulta",
        "cancelar_consulta",
        "confirmar_consulta",
    }


def test_scheduling_tools_present_in_global_action_tools():
    names = _names(AGENT_ACTION_TOOLS)
    for tool in (
        "listar_profissionais_consulta",
        "consultar_vagas_consulta",
        "criar_consulta",
        "reagendar_consulta",
        "cancelar_consulta",
        "confirmar_consulta",
    ):
        assert tool in names, f"tool {tool} ausente em AGENT_ACTION_TOOLS"


def test_consultar_vagas_consulta_does_not_require_confirmacao_paciente():
    tools_by_name = {t["name"]: t for t in AGENT_ACTION_TOOLS}
    schema = tools_by_name["consultar_vagas_consulta"]["input_schema"]
    required = set(schema.get("required", []))
    assert "confirmacao_paciente" not in required, (
        "consultar_vagas_consulta é read-only e NÃO deve exigir confirmacao_paciente"
    )
    assert "confirmacao_paciente" not in schema["properties"], (
        "consultar_vagas_consulta não deve sequer expor confirmacao_paciente"
    )
    assert {"scheduledProfessionalId", "stepKey", "from", "to"}.issubset(required)
    for opt in ("scheduledProfessionalId", "stepKey", "preferredDate", "motivo"):
        assert opt in schema["properties"], f"campo {opt} ausente em consultar_vagas_consulta"
    assert schema["properties"]["stepKey"]["enum"] == [
        "specialist_consultation",
        "navigation_consultation",
    ]


def test_listar_profissionais_consulta_is_readonly_and_requires_step_key():
    tools_by_name = {t["name"]: t for t in AGENT_ACTION_TOOLS}
    schema = tools_by_name["listar_profissionais_consulta"]["input_schema"]
    assert schema.get("required") == ["stepKey"]
    assert "confirmacao_paciente" not in schema.get("properties", {})
    assert schema["properties"]["stepKey"]["enum"] == [
        "specialist_consultation",
        "navigation_consultation",
    ]


def test_scheduling_tools_require_confirmacao_paciente_in_schema():
    expected = {
        "criar_consulta": ["scheduledProfessionalId", "expectedDate", "confirmacao_paciente"],
        "reagendar_consulta": ["navigationStepId", "newExpectedDate", "confirmacao_paciente"],
        "cancelar_consulta": ["navigationStepId", "confirmacao_paciente"],
        "confirmar_consulta": ["navigationStepId", "confirmacao_paciente"],
    }
    tools_by_name = {t["name"]: t for t in AGENT_ACTION_TOOLS}
    for name, required in expected.items():
        schema = tools_by_name[name]["input_schema"]
        assert set(required).issubset(set(schema.get("required", []))), (
            f"{name} deveria ter required ⊇ {required}, obteve {schema.get('required')}"
        )
        assert "confirmacao_paciente" in schema["properties"]


def test_orchestrator_routing_includes_secretary_and_keeps_navigation():
    names = _names(ORCHESTRATOR_ROUTING_TOOLS)
    assert "consultar_agente_secretaria" in names
    assert "consultar_agente_navegacao" in names


def test_navigation_agent_does_not_expose_scheduling_tools():
    nav_tool_names = _names(NavigationAgent().tools)
    scheduling = {
        "listar_profissionais_consulta",
        "consultar_vagas_consulta",
        "criar_consulta",
        "reagendar_consulta",
        "cancelar_consulta",
        "confirmar_consulta",
    }
    assert nav_tool_names.isdisjoint(scheduling), (
        "NavigationAgent não deve expor tools de agenda da secretária"
    )


# ----------------------------- parser: consultar_vagas_consulta -----------------------------

def test_parse_consultar_vagas_with_full_range_emits_readonly_action():
    tool_calls = [
        {
            "name": "consultar_vagas_consulta",
            "input": {
                "scheduledProfessionalId": "prof-1",
                "stepKey": "retorno_oncologia",
                "from": "2026-06-15T00:00:00-03:00",
                "to": "2026-06-20T23:59:59-03:00",
                "preferredDate": "2026-06-17T10:00:00-03:00",
                "motivo": "paciente quer marcar retorno",
            },
        }
    ]
    actions, decisions = orchestrator._parse_tool_calls_to_actions(tool_calls)

    assert len(actions) == 1
    a = actions[0]
    assert a["type"] == "CHECK_CONSULTATION_AVAILABILITY"
    assert a["requiresApproval"] is False
    assert a["source"] == "llm_tool_call"
    assert "confirmedByPatient" not in a["payload"], (
        "Action read-only não deve carregar confirmedByPatient"
    )
    payload = a["payload"]
    assert payload["scheduledProfessionalId"] == "prof-1"
    assert payload["stepKey"] == "specialist_consultation"
    assert payload["from"] == "2026-06-15T00:00:00-03:00"
    assert payload["to"] == "2026-06-20T23:59:59-03:00"
    assert payload["preferredDate"] == "2026-06-17T10:00:00-03:00"
    assert payload["motivo"] == "paciente quer marcar retorno"

    assert len(decisions) == 1
    d = decisions[0]
    assert d["decisionType"] == "APPOINTMENT_AVAILABILITY_QUERIED"
    assert d["requiresApproval"] is False
    assert d["outputAction"]["type"] == "CHECK_CONSULTATION_AVAILABILITY"
    assert d["inputData"]["payload"]["motivo"] == "[redacted]"
    assert d["outputAction"]["payload"]["motivo"] == "[redacted]"


def test_parse_consultar_vagas_with_step_key_only_requires_professional():
    tool_calls = [
        {
            "name": "consultar_vagas_consulta",
            "input": {
                "stepKey": "retorno_oncologia",
                "from": "2026-06-15T00:00:00-03:00",
                "to": "2026-06-20T23:59:59-03:00",
            },
        }
    ]
    actions, decisions = orchestrator._parse_tool_calls_to_actions(tool_calls)
    assert actions == []
    assert decisions[0]["decisionType"] == "SCHEDULING_INTAKE_PENDING"
    assert "scheduledProfessionalId" in decisions[0]["inputData"]["missing_fields"]


def test_parse_consultar_vagas_does_not_require_confirmacao_paciente_in_input():
    """Mesmo sem `confirmacao_paciente` no input, a action read-only deve sair."""
    tool_calls = [
        {
            "name": "consultar_vagas_consulta",
            "input": {
                "scheduledProfessionalId": "prof-1",
                "stepKey": "navigation_consultation",
                "from": "2026-06-15T00:00:00-03:00",
                "to": "2026-06-20T23:59:59-03:00",
            },
        }
    ]
    actions, decisions = orchestrator._parse_tool_calls_to_actions(tool_calls)
    assert len(actions) == 1
    assert actions[0]["type"] == "CHECK_CONSULTATION_AVAILABILITY"
    assert decisions[0]["decisionType"] == "APPOINTMENT_AVAILABILITY_QUERIED"


def test_parse_consultar_vagas_missing_range_does_not_emit_action():
    tool_calls = [
        {
            "name": "consultar_vagas_consulta",
            "input": {
                "scheduledProfessionalId": "prof-1",
                "from": "2026-06-15T00:00:00-03:00",
            },
        }
    ]
    actions, decisions = orchestrator._parse_tool_calls_to_actions(tool_calls)
    assert actions == []
    assert len(decisions) == 1
    d = decisions[0]
    assert d["decisionType"] == "SCHEDULING_INTAKE_PENDING"
    assert d["outputAction"]["type"] == "SCHEDULING_INTAKE_PENDING"
    assert "to" in d["inputData"]["missing_fields"]
    assert d["inputData"]["tool_name"] == "consultar_vagas_consulta"


def test_parse_consultar_vagas_missing_scope_does_not_emit_action():
    tool_calls = [
        {
            "name": "consultar_vagas_consulta",
            "input": {
                "from": "2026-06-15T00:00:00-03:00",
                "to": "2026-06-20T23:59:59-03:00",
            },
        }
    ]
    actions, decisions = orchestrator._parse_tool_calls_to_actions(tool_calls)
    assert actions == []
    d = decisions[0]
    assert d["decisionType"] == "SCHEDULING_INTAKE_PENDING"
    assert "scheduledProfessionalId" in d["inputData"]["missing_fields"]
    assert "stepKey" in d["inputData"]["missing_fields"]


# ----------------------------- parser: criar_consulta -----------------------------

def test_parse_criar_consulta_with_existing_patient_emits_action():
    tool_calls = [
        {
            "name": "criar_consulta",
            "input": {
                "scheduledProfessionalId": "prof-1",
                "expectedDate": "2026-06-15T10:00:00-03:00",
                "patientId": "pat-1",
                "stepKey": "retorno_oncologia",
                "stepName": "Consulta oncológica de retorno",
                "notes": "trazer exames de imagem",
                "confirmacao_paciente": True,
            },
        }
    ]
    actions, decisions = orchestrator._parse_tool_calls_to_actions(tool_calls)

    assert len(actions) == 1
    assert actions[0]["type"] == "CREATE_CONSULTATION_APPOINTMENT"
    payload = actions[0]["payload"]
    assert payload["scheduledProfessionalId"] == "prof-1"
    assert payload["expectedDate"] == "2026-06-15T10:00:00-03:00"
    assert payload["patientId"] == "pat-1"
    assert payload["confirmedByPatient"] is True

    assert len(decisions) == 1
    d = decisions[0]
    assert d["decisionType"] == "APPOINTMENT_CREATED"
    assert d["outputAction"]["type"] == "CREATE_CONSULTATION_APPOINTMENT"


def test_parse_criar_consulta_with_full_patient_intake_redacts_pii_in_input_data():
    tool_calls = [
        {
            "name": "criar_consulta",
            "input": {
                "scheduledProfessionalId": "prof-2",
                "expectedDate": "2026-06-15T10:00:00-03:00",
                "patientIntake": {
                    "name": "Maria Silva",
                    "cpf": "12345678900",
                    "birthDate": "1980-04-12",
                    "gender": "FEMALE",
                    "phone": "+5511999999999",
                    "email": "maria@example.com",
                    "healthCoverageType": "SUS",
                },
                "confirmacao_paciente": True,
            },
        }
    ]
    actions, decisions = orchestrator._parse_tool_calls_to_actions(tool_calls)

    assert len(actions) == 1
    payload = actions[0]["payload"]
    assert "patientIntake" in payload
    assert payload["patientIntake"]["name"] == "Maria Silva"
    assert payload["patientIntake"]["cpf"] == "12345678900"

    out_intake = decisions[0]["outputAction"]["payload"]["patientIntake"]
    assert out_intake["cpf"] == "12345678900"
    assert out_intake["phone"] == "+5511999999999"
    assert out_intake["email"] == "maria@example.com"
    assert out_intake["name"] == "Maria Silva"

    redacted = decisions[0]["inputData"]["payload_redacted"]["patientIntake"]
    assert redacted["cpf"] == "***"
    assert redacted["phone"] == "***"
    assert redacted["email"] == "***"
    assert redacted["name"] == "Maria Silva"


def test_parse_criar_consulta_missing_confirmation_does_not_emit_action():
    tool_calls = [
        {
            "name": "criar_consulta",
            "input": {
                "scheduledProfessionalId": "prof-1",
                "expectedDate": "2026-06-15T10:00:00-03:00",
                "patientId": "pat-1",
                "confirmacao_paciente": False,
            },
        }
    ]
    actions, decisions = orchestrator._parse_tool_calls_to_actions(tool_calls)
    assert actions == []
    assert len(decisions) == 1
    d = decisions[0]
    assert d["decisionType"] == "SCHEDULING_INTAKE_PENDING"
    assert d["outputAction"]["type"] == "SCHEDULING_INTAKE_PENDING"
    assert "confirmacao_paciente" in d["inputData"]["missing_fields"]


def test_parse_criar_consulta_missing_patient_intake_fields_does_not_emit_action():
    tool_calls = [
        {
            "name": "criar_consulta",
            "input": {
                "scheduledProfessionalId": "prof-2",
                "expectedDate": "2026-06-15T10:00:00-03:00",
                "patientIntake": {"name": "Apenas Nome"},
                "confirmacao_paciente": True,
            },
        }
    ]
    actions, decisions = orchestrator._parse_tool_calls_to_actions(tool_calls)
    assert actions == []
    d = decisions[0]
    assert d["decisionType"] == "SCHEDULING_INTAKE_PENDING"
    missing = d["inputData"]["missing_fields"]
    for f in ("patientIntake.cpf", "patientIntake.birthDate", "patientIntake.gender", "patientIntake.phone"):
        assert f in missing


def test_parse_criar_consulta_without_patient_id_or_intake_does_not_emit_action():
    tool_calls = [
        {
            "name": "criar_consulta",
            "input": {
                "scheduledProfessionalId": "prof-1",
                "expectedDate": "2026-06-15T10:00:00-03:00",
                "confirmacao_paciente": True,
            },
        }
    ]
    actions, decisions = orchestrator._parse_tool_calls_to_actions(tool_calls)
    assert actions == []
    assert decisions[0]["decisionType"] == "SCHEDULING_INTAKE_PENDING"
    assert "patientId|patientIntake" in decisions[0]["inputData"]["missing_fields"]


# ----------------------------- parser: reagendar_consulta -----------------------------

def test_parse_reagendar_consulta_full_payload_emits_action():
    tool_calls = [
        {
            "name": "reagendar_consulta",
            "input": {
                "navigationStepId": "step-1",
                "newExpectedDate": "2026-07-01T14:00:00-03:00",
                "newScheduledProfessionalId": "prof-3",
                "motivo": "conflito de horário",
                "confirmacao_paciente": True,
            },
        }
    ]
    actions, decisions = orchestrator._parse_tool_calls_to_actions(tool_calls)
    assert len(actions) == 1
    assert actions[0]["type"] == "RESCHEDULE_CONSULTATION_APPOINTMENT"
    assert actions[0]["payload"]["navigationStepId"] == "step-1"
    assert actions[0]["payload"]["newExpectedDate"] == "2026-07-01T14:00:00-03:00"
    assert actions[0]["payload"]["newScheduledProfessionalId"] == "prof-3"
    assert actions[0]["payload"]["motivo"] == "conflito de horário"
    assert decisions[0]["decisionType"] == "APPOINTMENT_RESCHEDULED"


def test_parse_reagendar_consulta_missing_new_date_does_not_emit_action():
    tool_calls = [
        {
            "name": "reagendar_consulta",
            "input": {
                "navigationStepId": "step-1",
                "confirmacao_paciente": True,
            },
        }
    ]
    actions, decisions = orchestrator._parse_tool_calls_to_actions(tool_calls)
    assert actions == []
    assert decisions[0]["decisionType"] == "SCHEDULING_INTAKE_PENDING"
    assert "newExpectedDate" in decisions[0]["inputData"]["missing_fields"]


# ----------------------------- parser: cancelar_consulta -----------------------------

def test_parse_cancelar_consulta_emits_action():
    tool_calls = [
        {
            "name": "cancelar_consulta",
            "input": {
                "navigationStepId": "step-7",
                "motivo": "viagem inesperada",
                "confirmacao_paciente": True,
            },
        }
    ]
    actions, decisions = orchestrator._parse_tool_calls_to_actions(tool_calls)
    assert len(actions) == 1
    assert actions[0]["type"] == "CANCEL_CONSULTATION_APPOINTMENT"
    assert actions[0]["payload"]["navigationStepId"] == "step-7"
    assert actions[0]["payload"]["motivo"] == "viagem inesperada"
    assert decisions[0]["decisionType"] == "APPOINTMENT_CANCELED"


def test_parse_cancelar_consulta_without_confirmation_does_not_emit_action():
    tool_calls = [
        {
            "name": "cancelar_consulta",
            "input": {"navigationStepId": "step-7"},
        }
    ]
    actions, decisions = orchestrator._parse_tool_calls_to_actions(tool_calls)
    assert actions == []
    assert decisions[0]["decisionType"] == "SCHEDULING_INTAKE_PENDING"


# ----------------------------- parser: confirmar_consulta -----------------------------

def test_parse_confirmar_consulta_emits_action():
    tool_calls = [
        {
            "name": "confirmar_consulta",
            "input": {
                "navigationStepId": "step-9",
                "notas": "paciente confirmou presença",
                "confirmacao_paciente": True,
            },
        }
    ]
    actions, decisions = orchestrator._parse_tool_calls_to_actions(tool_calls)
    assert len(actions) == 1
    assert actions[0]["type"] == "CONFIRM_CONSULTATION_APPOINTMENT"
    assert actions[0]["payload"]["navigationStepId"] == "step-9"
    assert actions[0]["payload"]["notas"] == "paciente confirmou presença"
    assert decisions[0]["decisionType"] == "APPOINTMENT_CONFIRMED"


def test_parse_confirmar_consulta_missing_step_id_does_not_emit_action():
    tool_calls = [
        {
            "name": "confirmar_consulta",
            "input": {"confirmacao_paciente": True},
        }
    ]
    actions, decisions = orchestrator._parse_tool_calls_to_actions(tool_calls)
    assert actions == []
    assert decisions[0]["decisionType"] == "SCHEDULING_INTAKE_PENDING"
    assert "navigationStepId" in decisions[0]["inputData"]["missing_fields"]


# ----------------------------- dedupe -----------------------------

def test_merge_actions_dedupes_duplicate_create_consultation():
    llm_actions = [
        {
            "type": "CREATE_CONSULTATION_APPOINTMENT",
            "payload": {
                "scheduledProfessionalId": "prof-1",
                "expectedDate": "2026-06-15T10:00:00-03:00",
                "patientId": "pat-1",
            },
        }
    ]
    rule_actions = [
        {
            "type": "CREATE_CONSULTATION_APPOINTMENT",
            "payload": {
                "scheduledProfessionalId": "prof-1",
                "expectedDate": "2026-06-15T10:00:00-03:00",
                "patientId": "pat-1",
            },
        }
    ]
    merged = orchestrator._merge_actions(llm_actions, rule_actions)
    assert len(merged) == 1


def test_merge_actions_keeps_distinct_create_consultation_dates():
    llm_actions = [
        {
            "type": "CREATE_CONSULTATION_APPOINTMENT",
            "payload": {
                "scheduledProfessionalId": "prof-1",
                "expectedDate": "2026-06-15T10:00:00-03:00",
                "patientId": "pat-1",
            },
        },
        {
            "type": "CREATE_CONSULTATION_APPOINTMENT",
            "payload": {
                "scheduledProfessionalId": "prof-1",
                "expectedDate": "2026-07-20T10:00:00-03:00",
                "patientId": "pat-1",
            },
        },
    ]
    merged = orchestrator._merge_actions(llm_actions, [])
    assert len(merged) == 2


def test_merge_actions_dedupes_identical_check_availability():
    llm_actions = [
        {
            "type": "CHECK_CONSULTATION_AVAILABILITY",
            "payload": {
                "scheduledProfessionalId": "prof-1",
                "stepKey": "retorno_oncologia",
                "from": "2026-06-15T00:00:00-03:00",
                "to": "2026-06-20T23:59:59-03:00",
            },
        }
    ]
    rule_actions = [
        {
            "type": "CHECK_CONSULTATION_AVAILABILITY",
            "payload": {
                "scheduledProfessionalId": "prof-1",
                "stepKey": "retorno_oncologia",
                "from": "2026-06-15T00:00:00-03:00",
                "to": "2026-06-20T23:59:59-03:00",
            },
        }
    ]
    merged = orchestrator._merge_actions(llm_actions, rule_actions)
    assert len(merged) == 1


def test_merge_actions_keeps_distinct_check_availability_ranges():
    """Faixas/ranges diferentes representam consultas legítimas distintas — não colapsar."""
    llm_actions = [
        {
            "type": "CHECK_CONSULTATION_AVAILABILITY",
            "payload": {
                "scheduledProfessionalId": "prof-1",
                "from": "2026-06-15T00:00:00-03:00",
                "to": "2026-06-20T23:59:59-03:00",
            },
        },
        {
            "type": "CHECK_CONSULTATION_AVAILABILITY",
            "payload": {
                "scheduledProfessionalId": "prof-1",
                "from": "2026-07-01T00:00:00-03:00",
                "to": "2026-07-07T23:59:59-03:00",
            },
        },
    ]
    merged = orchestrator._merge_actions(llm_actions, [])
    assert len(merged) == 2


def test_merge_actions_keeps_check_availability_with_distinct_scope():
    """Mesma faixa mas profissional/stepKey diferente também não colapsa."""
    llm_actions = [
        {
            "type": "CHECK_CONSULTATION_AVAILABILITY",
            "payload": {
                "scheduledProfessionalId": "prof-1",
                "from": "2026-06-15T00:00:00-03:00",
                "to": "2026-06-20T23:59:59-03:00",
            },
        },
        {
            "type": "CHECK_CONSULTATION_AVAILABILITY",
            "payload": {
                "scheduledProfessionalId": "prof-2",
                "from": "2026-06-15T00:00:00-03:00",
                "to": "2026-06-20T23:59:59-03:00",
            },
        },
    ]
    merged = orchestrator._merge_actions(llm_actions, [])
    assert len(merged) == 2


def test_merge_actions_keeps_same_prof_and_range_distinct_step_key():
    """Dedupe de CHECK inclui stepKey: mesmo profissional e janela, etapas diferentes → manter ambos."""
    llm_actions = [
        {
            "type": "CHECK_CONSULTATION_AVAILABILITY",
            "payload": {
                "scheduledProfessionalId": "prof-1",
                "stepKey": "navigation_consultation",
                "from": "2026-06-15T00:00:00-03:00",
                "to": "2026-06-20T23:59:59-03:00",
            },
        },
        {
            "type": "CHECK_CONSULTATION_AVAILABILITY",
            "payload": {
                "scheduledProfessionalId": "prof-1",
                "stepKey": "specialist_consultation",
                "from": "2026-06-15T00:00:00-03:00",
                "to": "2026-06-20T23:59:59-03:00",
            },
        },
    ]
    merged = orchestrator._merge_actions(llm_actions, [])
    assert len(merged) == 2
