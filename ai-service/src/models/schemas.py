"""
Pydantic models for agent API request/response schemas.
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any


# ============================================
# Agent Process (main endpoint)
# ============================================

class AgentProcessRequest(BaseModel):
    """Request to process a patient message through the agent."""

    message: str = Field(..., description="Patient message content")
    patient_id: str = Field(..., description="Patient UUID")
    tenant_id: str = Field(..., description="Tenant UUID")
    clinical_context: Dict[str, Any] = Field(
        default_factory=dict, description="Full clinical context from backend"
    )
    protocol: Optional[Dict[str, Any]] = Field(
        None, description="Active clinical protocol"
    )
    conversation_history: List[Dict[str, str]] = Field(
        default_factory=list,
        description="Recent conversation messages [{role, content}]",
    )
    agent_state: Dict[str, Any] = Field(
        default_factory=dict, description="Persistent agent state"
    )
    agent_config: Optional[Dict[str, Any]] = Field(
        None, description="Tenant agent configuration"
    )


class DetectedSymptom(BaseModel):
    """A detected symptom from the message."""

    name: str
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    confidence: float = 0.0
    action: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class SymptomAnalysisResult(BaseModel):
    """Result of symptom analysis."""

    detectedSymptoms: List[DetectedSymptom] = Field(default_factory=list)
    overallSeverity: str = "LOW"
    requiresEscalation: bool = False
    structuredData: Dict[str, Any] = Field(default_factory=dict)
    escalationReason: Optional[str] = None


class AgentDecision(BaseModel):
    """A decision made by the agent."""

    decisionType: str
    reasoning: str
    confidence: Optional[float] = None
    inputData: Dict[str, Any] = Field(default_factory=dict)
    outputAction: Dict[str, Any] = Field(default_factory=dict)
    requiresApproval: bool = False


class AgentProcessResponse(BaseModel):
    """Response from agent processing."""

    response: str = Field(..., description="Agent response to send to patient")
    actions: List[Dict[str, Any]] = Field(
        default_factory=list, description="Actions to execute"
    )
    symptom_analysis: Optional[SymptomAnalysisResult] = None
    new_state: Dict[str, Any] = Field(
        default_factory=dict, description="Updated agent state"
    )
    decisions: List[AgentDecision] = Field(
        default_factory=list, description="Decisions made by the agent"
    )


# ============================================
# Build Context
# ============================================

class BuildContextRequest(BaseModel):
    """Request to build clinical context."""

    patient_id: str
    tenant_id: str
    clinical_context: Dict[str, Any] = Field(default_factory=dict)
    protocol: Optional[Dict[str, Any]] = None


class ClinicalContextResponse(BaseModel):
    """Built clinical context."""

    context: str = Field(..., description="Formatted clinical context string")
    patient_summary: str = Field(
        "", description="Brief patient summary"
    )


# ============================================
# Symptom Analysis
# ============================================

class SymptomAnalysisRequest(BaseModel):
    """Request for symptom analysis."""

    message: str
    patient_id: str
    cancer_type: Optional[str] = None
    clinical_context: Optional[Dict[str, Any]] = None
    use_llm: bool = True
    agent_config: Optional[Dict[str, Any]] = None


class SymptomAnalysisResponse(BaseModel):
    """Response from symptom analysis."""

    detected_symptoms: List[DetectedSymptom] = Field(default_factory=list)
    overall_severity: str = "LOW"
    requires_escalation: bool = False
    structured_data: Dict[str, Any] = Field(default_factory=dict)
    escalation_reason: Optional[str] = None


# ============================================
# Questionnaire Scoring
# ============================================

class QuestionnaireScoreRequest(BaseModel):
    """Request to score a completed questionnaire."""

    questionnaire_type: str = Field(..., description="'ESAS' or 'PRO_CTCAE'")
    answers: Dict[str, Any] = Field(
        ..., description="Map of item keys to numeric values"
    )
    patient_id: Optional[str] = None
    tenant_id: Optional[str] = None


class QuestionnaireScoreResponse(BaseModel):
    """Scored questionnaire results."""

    questionnaire_type: str
    scores: Dict[str, Any] = Field(..., description="Computed scores per item/total")
    interpretation: str = Field("", description="Human-readable interpretation")
    alerts: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="High-score alerts that should trigger nursing notification",
    )


# ============================================
# Protocol Evaluation
# ============================================

class ProtocolEvaluateRequest(BaseModel):
    """Request to evaluate protocol rules for a patient."""

    cancer_type: Optional[str] = None
    journey_stage: Optional[str] = None
    symptom_analysis: Optional[Dict[str, Any]] = None
    agent_state: Optional[Dict[str, Any]] = None
    protocol: Optional[Dict[str, Any]] = None
    patient_id: Optional[str] = None
    tenant_id: Optional[str] = None


class ProtocolEvaluateResponse(BaseModel):
    """Protocol evaluation result."""

    actions: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Protocol-driven actions to execute",
    )
    required_questionnaire: Optional[str] = Field(
        None, description="Questionnaire type required for this stage (ESAS, PRO_CTCAE, or None)"
    )


# ============================================
# Personalized Check-in Message
# ============================================

class CheckInMessageRequest(BaseModel):
    """Request to generate a personalized check-in message for a patient."""

    patient_id: str = Field(..., description="Patient UUID")
    tenant_id: str = Field(..., description="Tenant UUID")
    action_type: str = Field(
        "CHECK_IN",
        description="Type of proactive message: CHECK_IN, QUESTIONNAIRE, MEDICATION_REMINDER, APPOINTMENT_REMINDER, FOLLOW_UP",
    )
    clinical_context: Dict[str, Any] = Field(
        default_factory=dict,
        description="Full clinical context from backend",
    )
    agent_config: Optional[Dict[str, Any]] = Field(
        None, description="LLM provider config",
    )


class CheckInMessageResponse(BaseModel):
    """Response with personalized check-in message."""

    message: str = Field(..., description="Personalized check-in message")
    used_llm: bool = Field(False, description="Whether the LLM was used to generate the message")


# ============================================
# Predictive Risk Analysis
# ============================================

class NavigationStepInfo(BaseModel):
    """Simplified navigation step data for risk analysis."""

    step_key: str
    step_name: str
    status: str
    is_required: bool = True
    expected_date: Optional[str] = None
    due_date: Optional[str] = None
    completed_at: Optional[str] = None


class ESASScoreEntry(BaseModel):
    """A single ESAS questionnaire result."""

    completed_at: str
    scores: Dict[str, Any] = Field(default_factory=dict)


class PredictRiskRequest(BaseModel):
    """Request to predict risk factors for a single patient."""

    patient_id: str
    patient_name: Optional[str] = None
    cancer_type: Optional[str] = None
    stage: Optional[str] = None
    performance_status: Optional[int] = None
    priority_score: Optional[int] = 0
    last_interaction_days: int = Field(0, description="Days since last patient interaction")
    navigation_steps: List[NavigationStepInfo] = Field(default_factory=list)
    esas_history: List[ESASScoreEntry] = Field(
        default_factory=list,
        description="Recent ESAS questionnaire scores (newest first)",
    )
    total_messages: int = Field(0, description="Total messages exchanged")
    days_since_registration: int = Field(0, description="Days since patient registration")


class RiskPrediction(BaseModel):
    """A single risk prediction."""

    risk_type: str = Field(..., description="STEP_DELAY | SYMPTOM_WORSENING | NO_RESPONSE | ABANDONMENT")
    probability: float = Field(..., ge=0, le=1)
    severity: str = Field(..., description="LOW | MEDIUM | HIGH | CRITICAL")
    message: str
    details: Dict[str, Any] = Field(default_factory=dict)


class PredictRiskResponse(BaseModel):
    """Response with risk predictions for a patient."""

    patient_id: str
    risks: List[RiskPrediction] = Field(default_factory=list)
    highest_severity: str = "LOW"


class BulkPredictRiskRequest(BaseModel):
    """Request to predict risk for multiple patients."""

    patients: List[PredictRiskRequest]


class BulkPredictRiskResponse(BaseModel):
    """Response with risk predictions for multiple patients."""

    results: List[PredictRiskResponse] = Field(default_factory=list)


# ============================================
# Nurse AI Assistant
# ============================================

class ConversationMessageInput(BaseModel):
    """A single message from the conversation history."""

    role: str = Field(..., description="patient | agent | nursing")
    content: str
    timestamp: Optional[str] = None


class NurseAssistRequest(BaseModel):
    """Request for the nurse AI assistant."""

    patient_id: str
    patient_name: str
    cancer_type: Optional[str] = None
    stage: Optional[str] = None
    performance_status: Optional[int] = None
    priority_score: Optional[int] = 0
    priority_category: Optional[str] = "LOW"
    current_stage: Optional[str] = None
    conversation_history: List[ConversationMessageInput] = Field(default_factory=list)
    navigation_steps: List[NavigationStepInfo] = Field(default_factory=list)
    recent_symptoms: List[str] = Field(default_factory=list)
    esas_scores: Optional[Dict[str, Any]] = None
    alerts: List[str] = Field(default_factory=list)


class SuggestedReply(BaseModel):
    """A suggested reply for the nurse to send to the patient."""

    label: str = Field(..., description="Short label like 'Empática', 'Informativa', 'Ação'")
    text: str = Field(..., description="Full message text")


class SuggestedAction(BaseModel):
    """A suggested clinical action for the nurse."""

    action: str = Field(..., description="Action description")
    reason: str = Field(..., description="Why this action is recommended")
    priority: str = Field("MEDIUM", description="LOW | MEDIUM | HIGH | CRITICAL")


class NurseAssistResponse(BaseModel):
    """Response from the nurse AI assistant."""

    summary: str = Field(..., description="Brief conversation summary with clinical highlights")
    suggested_replies: List[SuggestedReply] = Field(default_factory=list)
    suggested_actions: List[SuggestedAction] = Field(default_factory=list)
    used_llm: bool = Field(False)


# ==========================================
# Patient Summary (P8)
# ==========================================


class PatientSummaryRequest(BaseModel):
    """Request for intelligent patient summary."""

    patient_id: str
    patient_name: str
    cancer_type: Optional[str] = None
    stage: Optional[str] = None
    performance_status: Optional[int] = None
    priority_score: Optional[int] = 0
    priority_category: Optional[str] = "LOW"
    current_stage: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    comorbidities: List[str] = Field(default_factory=list)
    navigation_steps: List[NavigationStepInfo] = Field(default_factory=list)
    recent_symptoms: List[str] = Field(default_factory=list)
    esas_scores: Optional[Dict[str, Any]] = None
    alerts: List[str] = Field(default_factory=list)
    recent_conversations_count: int = 0
    last_interaction_date: Optional[str] = None
    treatments: List[str] = Field(default_factory=list)


class SummaryHighlight(BaseModel):
    """A clinical highlight in the patient summary."""

    icon: str = Field("info", description="Icon hint: info | warning | success | clock")
    text: str


class SummaryRisk(BaseModel):
    """An identified risk in the patient summary."""

    risk: str
    severity: str = Field("MEDIUM", description="LOW | MEDIUM | HIGH | CRITICAL")


class SummaryNextStep(BaseModel):
    """A recommended next step in the patient summary."""

    step: str
    urgency: str = Field("NORMAL", description="LOW | NORMAL | HIGH | URGENT")


class PatientSummaryResponse(BaseModel):
    """Intelligent patient summary generated by LLM."""

    narrative: str = Field(..., description="3-5 line narrative summary of the patient")
    highlights: List[SummaryHighlight] = Field(default_factory=list)
    risks: List[SummaryRisk] = Field(default_factory=list)
    next_steps: List[SummaryNextStep] = Field(default_factory=list)
    used_llm: bool = Field(False)
