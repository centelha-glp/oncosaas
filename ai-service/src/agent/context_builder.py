"""
Clinical Context Builder (RAG).
Builds formatted clinical context from patient data for the LLM system prompt.
"""

from typing import Dict, List, Optional, Any
import logging

logger = logging.getLogger(__name__)


class ClinicalContextBuilder:
    """
    Monta contexto clínico completo para o prompt do agente.
    Recebe dados do backend e formata para o LLM.
    """

    def build(
        self,
        clinical_context: Dict[str, Any],
        protocol: Optional[Dict[str, Any]] = None,
        symptom_analysis: Optional[Dict[str, Any]] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """
        Build formatted clinical context string for the system prompt.

        Args:
            clinical_context: Full patient clinical data from backend
            protocol: Active clinical protocol for cancer type
            symptom_analysis: Current symptom analysis results
            conversation_history: Recent conversation messages

        Returns:
            Formatted string for inclusion in the system prompt
        """
        sections = []

        patient = clinical_context.get("patient", {})
        if patient:
            sections.append(self._format_patient_data(patient))

        diagnoses = clinical_context.get("diagnoses", [])
        if diagnoses:
            sections.append(self._format_diagnoses(diagnoses))

        treatments = clinical_context.get("treatments", [])
        if treatments:
            sections.append(self._format_treatments(treatments))

        nav_steps = clinical_context.get("navigationSteps", [])
        if nav_steps:
            sections.append(self._format_navigation_steps(nav_steps))

        alerts = clinical_context.get("recentAlerts", [])
        if alerts:
            sections.append(self._format_recent_alerts(alerts))

        qr = clinical_context.get("questionnaireResponses", [])
        if qr:
            sections.append(self._format_questionnaire_history(qr))

        observations = clinical_context.get("observations", [])
        if observations:
            sections.append(self._format_observations(observations))

        if protocol:
            sections.append(self._format_protocol_context(protocol))

        if symptom_analysis and symptom_analysis.get("detectedSymptoms"):
            sections.append(self._format_symptom_analysis(symptom_analysis))

        return "\n\n".join(sections) if sections else "Contexto clínico não disponível."

    def _format_patient_data(self, patient: Dict) -> str:
        """Format basic patient data."""
        lines = ["### Dados do Paciente"]
        lines.append(f"- **Nome**: {patient.get('name', 'Não informado')}")

        if patient.get("cancerType"):
            lines.append(f"- **Tipo de câncer**: {patient['cancerType']}")
        if patient.get("stage"):
            lines.append(f"- **Estadiamento**: {patient['stage']}")
        if patient.get("currentStage"):
            lines.append(f"- **Etapa da jornada**: {patient['currentStage']}")
        if patient.get("performanceStatus") is not None:
            lines.append(f"- **Performance Status (ECOG)**: {patient['performanceStatus']}")

        priority = patient.get("priorityCategory", "LOW")
        score = patient.get("priorityScore", 0)
        lines.append(f"- **Prioridade**: {priority} (score: {score})")

        return "\n".join(lines)

    def _format_diagnoses(self, diagnoses: List[Dict]) -> str:
        """Format cancer diagnoses."""
        lines = ["### Diagnósticos Ativos"]

        for dx in diagnoses[:5]:
            cancer = dx.get("cancerType", "Não especificado")
            stage = dx.get("stage", "")
            histological = dx.get("histologicalType", "")

            detail = f"- **{cancer}**"
            if stage:
                detail += f" - Estágio {stage}"
            if histological:
                detail += f" ({histological})"
            lines.append(detail)

            # Biomarkers
            biomarkers = []
            if dx.get("her2Status"):
                biomarkers.append(f"HER2: {dx['her2Status']}")
            if dx.get("egfrMutation"):
                biomarkers.append(f"EGFR: {dx['egfrMutation']}")
            if dx.get("krasMutation"):
                biomarkers.append(f"KRAS: {dx['krasMutation']}")
            if dx.get("pdl1Expression") is not None:
                biomarkers.append(f"PD-L1: {dx['pdl1Expression']}%")
            if dx.get("msiStatus"):
                biomarkers.append(f"MSI: {dx['msiStatus']}")
            if dx.get("gleasonScore"):
                biomarkers.append(f"Gleason: {dx['gleasonScore']}")
            if dx.get("psaBaseline") is not None:
                biomarkers.append(f"PSA: {dx['psaBaseline']}")

            if biomarkers:
                lines.append(f"  Biomarcadores: {', '.join(biomarkers)}")

        return "\n".join(lines)

    def _format_treatments(self, treatments: List[Dict]) -> str:
        """Format active treatments."""
        lines = ["### Tratamentos Ativos"]

        for tx in treatments[:5]:
            name = tx.get("treatmentName") or tx.get("treatmentType", "Não especificado")
            status = tx.get("status", "")
            line_num = tx.get("line")

            detail = f"- **{name}**"
            if line_num:
                detail += f" ({line_num}ª linha)"
            if status:
                detail += f" - {status}"
            lines.append(detail)

            cycle = tx.get("currentCycle")
            total = tx.get("totalCycles")
            if cycle and total:
                lines.append(f"  Ciclo: {cycle}/{total}")
            elif cycle:
                lines.append(f"  Ciclo atual: {cycle}")

            if tx.get("lastCycleDate"):
                lines.append(f"  Último ciclo: {tx['lastCycleDate']}")

            toxicities = tx.get("toxicities")
            if toxicities and isinstance(toxicities, list):
                tox_str = ", ".join(
                    f"{t.get('type', '?')} (grau {t.get('grade', '?')})"
                    for t in toxicities[:3]
                )
                lines.append(f"  Toxicidades: {tox_str}")

        return "\n".join(lines)

    def _format_navigation_steps(self, steps: List[Dict]) -> str:
        """Format pending navigation steps."""
        lines = ["### Etapas de Navegação Pendentes"]

        for step in steps[:10]:
            name = step.get("stepName", "Etapa")
            status = step.get("status", "PENDING")
            due = step.get("dueDate")

            icon = "⏳" if status == "PENDING" else "🔄" if status == "IN_PROGRESS" else "⚠️"
            detail = f"- {icon} {name} ({status})"
            if due:
                detail += f" - Prazo: {due}"
            lines.append(detail)

        return "\n".join(lines)

    def _format_recent_alerts(self, alerts: List[Dict]) -> str:
        """Format recent alerts."""
        lines = ["### Alertas Recentes"]

        for alert in alerts[:5]:
            severity = alert.get("severity", "MEDIUM")
            message = alert.get("message", "")
            status = alert.get("status", "PENDING")

            icon = "🔴" if severity == "CRITICAL" else "🟠" if severity == "HIGH" else "🟡"
            lines.append(f"- {icon} [{severity}] {message} ({status})")

        return "\n".join(lines)

    def _format_questionnaire_history(self, responses: List[Dict]) -> str:
        """Format recent questionnaire responses."""
        lines = ["### Últimos Questionários"]

        for qr in responses[:3]:
            completed = qr.get("completedAt", "")
            scores = qr.get("scores")

            detail = f"- Completado em: {completed}"
            if scores and isinstance(scores, dict):
                score_str = ", ".join(f"{k}: {v}" for k, v in scores.items())
                detail += f"\n  Scores: {score_str}"
            lines.append(detail)

        return "\n".join(lines)

    def _format_observations(self, observations: List[Dict]) -> str:
        """Format recent clinical observations."""
        lines = ["### Observações Clínicas Recentes"]

        for obs in observations[:10]:
            display = obs.get("display", obs.get("code", ""))
            value = obs.get("valueString") or obs.get("valueQuantity")
            unit = obs.get("unit", "")
            date = obs.get("effectiveDateTime", "")

            detail = f"- {display}: {value}"
            if unit:
                detail += f" {unit}"
            if date:
                detail += f" ({date})"
            lines.append(detail)

        return "\n".join(lines)

    def _format_protocol_context(self, protocol: Dict) -> str:
        """Format active protocol rules."""
        lines = ["### Protocolo Clínico Ativo"]

        lines.append(f"- **Nome**: {protocol.get('name', 'Protocolo')}")
        lines.append(f"- **Tipo de câncer**: {protocol.get('cancerType', '')}")
        lines.append(f"- **Versão**: {protocol.get('version', '1.0')}")

        check_in = protocol.get("checkInRules")
        if check_in and isinstance(check_in, dict):
            lines.append("\n**Regras de Check-in:**")
            for stage, rules in check_in.items():
                freq = rules.get("frequency", "?") if isinstance(rules, dict) else rules
                lines.append(f"  - {stage}: {freq}")

        critical = protocol.get("criticalSymptoms")
        if critical and isinstance(critical, list):
            lines.append("\n**Sintomas Críticos Específicos:**")
            for symptom in critical[:5]:
                if isinstance(symptom, dict):
                    lines.append(
                        f"  - {symptom.get('keyword', '?')} "
                        f"[{symptom.get('severity', '?')}] → {symptom.get('action', '?')}"
                    )

        return "\n".join(lines)

    def _format_symptom_analysis(self, analysis: Dict) -> str:
        """Format current symptom analysis."""
        lines = ["### Análise de Sintomas (Mensagem Atual)"]

        for symptom in analysis.get("detectedSymptoms", []):
            name = symptom.get("name", "?")
            severity = symptom.get("severity", "?")
            confidence = symptom.get("confidence", 0)
            lines.append(f"- **{name}** [{severity}] (confiança: {confidence:.0%})")

        overall = analysis.get("overallSeverity", "LOW")
        lines.append(f"\n**Severidade geral**: {overall}")

        if analysis.get("requiresEscalation"):
            lines.append("**⚠️ REQUER ESCALAÇÃO IMEDIATA**")

        return "\n".join(lines)


# Global instance
context_builder = ClinicalContextBuilder()
