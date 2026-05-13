"""
Tests for SchedulingSecretaryAgent and orchestrator scheduling tool parser.

Cobre:
- subagente expõe apenas as 4 tools de agenda
- ORCHESTRATOR_ROUTING_TOOLS inclui `consultar_agente_secretaria`
- parser do orchestrator gera as 4 actions/decisions corretas
- payload incompleto NÃO gera ação (decisão de coleta)
- ausência de confirmacao_paciente NÃO gera ação
- patientId xor patientIntake para criar_consulta
- dedupe de actions de agenda
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


def test_scheduling_secretary_exposes_only_appointment_tools():
    agent = SchedulingSecretaryAgent()
    tool_names = _names(agent.tools)
    assert tool_names == {
        "criar_consulta",
        "reagendar_consulta",
        "cancelar_consulta",
        "confirmar_consulta",
    }


def test_scheduling_tools_present_in_global_action_tools():
    names = _names(AGENT_ACTION_TOOLS)
    for tool in ("criar_consulta", "reagendar_consulta", "cancelar_consulta", "confirmar_consulta"):
        assert tool in names, f"tool {tool} ausente em AGENT_ACTION_TOOLS"


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
    scheduling = {"criar_consulta", "reagendar_consulta", "cancelar_consulta", "confirmar_consulta"}
    assert nav_tool_names.isdisjoint(scheduling), (
        "NavigationAgent não deve expor tools de mutação de agenda"
    )


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
