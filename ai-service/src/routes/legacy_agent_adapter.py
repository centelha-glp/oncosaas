"""
Adapter legado: POST /agent/message → mesmo pipeline que /agent/process.

Converte `patient_context` plano (campos antigos do WhatsApp) em `clinical_context`
mínimo compatível com o orquestrador quando `clinical_context` completo não é enviado.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

# Valores alinhados a `clinical_rules` — evita import pesado na carga do router.
_ER_ALERT_DISPOSITIONS = frozenset({"ER_IMMEDIATE", "ER_DAYS"})


class AgentMessageRequest(BaseModel):
    """Corpo para POST /agent/message — mesmo pipeline que /agent/process (orquestrador)."""

    message: str
    patient_id: str
    tenant_id: str = Field(..., description="Obrigatório: isolamento multi-tenant e trace")
    patient_context: Dict[str, Any] = Field(default_factory=dict)
    conversation_history: List[Dict[str, Any]] = Field(default_factory=list)
    clinical_context: Optional[Dict[str, Any]] = Field(
        None,
        description="Se omitido, deriva-se de patient_context (legado)",
    )
    protocol: Optional[Dict[str, Any]] = None
    agent_state: Dict[str, Any] = Field(default_factory=dict)
    agent_config: Optional[Dict[str, Any]] = None


def legacy_patient_context_to_clinical_context(patient_context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Mapeia dict plano (name, cancer_type, treatment, …) para o formato esperado
    em clinical_context['patient'].
    """
    if not patient_context:
        return {"patient": {}}

    if "patient" in patient_context and isinstance(patient_context["patient"], dict):
        return {"patient": dict(patient_context["patient"])}

    patient: Dict[str, Any] = {}
    if "name" in patient_context:
        patient["name"] = patient_context["name"]
    if "cancer_type" in patient_context:
        patient["cancerType"] = patient_context["cancer_type"]
    if "cancerType" in patient_context:
        patient["cancerType"] = patient_context["cancerType"]
    if "stage" in patient_context:
        patient["stage"] = patient_context["stage"]
    if "currentStage" in patient_context:
        patient["currentStage"] = patient_context["currentStage"]
    if "treatment" in patient_context:
        patient["treatmentSummary"] = patient_context["treatment"]
    if "treatmentSummary" in patient_context:
        patient["treatmentSummary"] = patient_context["treatmentSummary"]
    if "priorityCategory" in patient_context:
        patient["priorityCategory"] = patient_context["priorityCategory"]
    if "priorityScore" in patient_context:
        patient["priorityScore"] = patient_context["priorityScore"]
    if "performanceStatus" in patient_context:
        patient["performanceStatus"] = patient_context["performanceStatus"]

    return {"patient": patient}


def message_request_to_process_payload(req: AgentMessageRequest) -> Dict[str, Any]:
    """Monta o dict consumido por `orchestrator.process`."""
    clinical = (
        req.clinical_context
        if req.clinical_context is not None
        else legacy_patient_context_to_clinical_context(req.patient_context)
    )
    return {
        "message": req.message,
        "patient_id": req.patient_id,
        "tenant_id": req.tenant_id,
        "clinical_context": clinical,
        "protocol": req.protocol,
        "conversation_history": req.conversation_history,
        "agent_state": req.agent_state,
        "agent_config": req.agent_config,
    }


def _critical_symptom_names(symptom_analysis: Dict[str, Any]) -> List[str]:
    out: List[str] = []
    for s in symptom_analysis.get("detectedSymptoms") or []:
        if not isinstance(s, dict):
            continue
        sev = (s.get("severity") or "").upper()
        if sev in ("CRITICAL", "HIGH"):
            name = s.get("name")
            if name:
                out.append(str(name))
    return out


def _actions_imply_alert(actions: Any) -> bool:
    if not isinstance(actions, list):
        return False
    alert_types = {"CREATE_HIGH_CRITICAL_ALERT", "CREATE_LOW_ALERT"}
    for a in actions:
        if not isinstance(a, dict):
            continue
        t = a.get("type")
        if t in alert_types:
            return True
        out = a.get("outputAction")
        if isinstance(out, dict) and out.get("type") in alert_types:
            return True
    return False


def _should_alert_from_process_result(result: Dict[str, Any]) -> bool:
    sa = result.get("symptom_analysis") or {}
    if isinstance(sa, dict) and sa.get("requiresEscalation"):
        return True
    disp = result.get("clinical_disposition")
    if disp in _ER_ALERT_DISPOSITIONS:
        return True
    if _actions_imply_alert(result.get("actions")):
        return True
    return False


def agent_process_dict_to_message_response(result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Mapeia saída do orquestrador para o contrato legado `AgentMessageResponse`.

    - `critical_symptoms`: nomes com severidade HIGH ou CRITICAL em detectedSymptoms
    - `structured_data`: structuredData do symptom_analysis (ou dict vazio)
    - `should_alert`: requiresEscalation OU disposição ER OU ações de alerta compiladas
    """
    sa = result.get("symptom_analysis")
    if not isinstance(sa, dict):
        sa = {}
    structured = sa.get("structuredData")
    if not isinstance(structured, dict):
        structured = {}
    return {
        "response": result.get("response", "") or "",
        "critical_symptoms": _critical_symptom_names(sa),
        "structured_data": structured,
        "should_alert": _should_alert_from_process_result({**result, "symptom_analysis": sa}),
    }
