"""
Clinical Context Builder (RAG).
Builds formatted clinical context from patient data for the LLM system prompt.
Integrates with the oncology knowledge RAG for evidence-based responses.
"""

from typing import Dict, List, Optional, Any
import logging

from .rag import knowledge_rag

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
        agent_state: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Build formatted clinical context string for the system prompt.

        Args:
            clinical_context: Full patient clinical data from backend
            protocol: Active clinical protocol for cancer type
            symptom_analysis: Current symptom analysis results
            conversation_history: Recent conversation messages
            agent_state: Agent state with last_symptoms, last_symptom_severity

        Returns:
            Formatted string for inclusion in the system prompt
        """
        sections = []

        symptom_topic_active = False
        if agent_state and agent_state.get("last_symptoms"):
            severity = agent_state.get("last_symptom_severity", "LOW")
            symptoms = ", ".join(s.get("name", "?") for s in agent_state["last_symptoms"])
            sections.append(
                f"### TÓPICO EM DISCUSSÃO (prioridade sobre etapas de navegação)\n"
                f"O paciente está discutindo sintoma(s): **{symptoms}** "
                f"[{severity}]. Conclua esse tópico antes de falar de exames ou agendamentos."
            )
            symptom_topic_active = severity in ("HIGH", "CRITICAL")

        patient = clinical_context.get("patient", {})
        if patient:
            sections.append(self._format_patient_data(patient))

        diagnoses = clinical_context.get("diagnoses", [])
        if diagnoses:
            sections.append(self._format_diagnoses(diagnoses))

        treatments = clinical_context.get("treatments", [])
        if treatments:
            sections.append(self._format_treatments(treatments))

        medications = clinical_context.get("medications", [])
        if medications:
            sections.append(self._format_medications(medications))

        comorbidities = clinical_context.get("comorbidities", [])
        if comorbidities:
            sections.append(self._format_comorbidities(comorbidities))

        nav_steps = clinical_context.get("navigationSteps", [])
        if nav_steps:
            if symptom_topic_active:
                sections.append(
                    "### Etapas de Navegação\n"
                    "(Omitidas neste turno — concluir discussão do sintoma antes de mencionar exames ou agendamentos.)"
                )
            else:
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

    _GENERIC_REPLIES = frozenset({"sim", "não", "nao", "ok", "é", "eh", "isso", "exato", "correto", "verdade", "isso mesmo"})

    def build_with_rag(
        self,
        patient_message: str,
        clinical_context: Dict[str, Any],
        protocol: Optional[Dict[str, Any]] = None,
        symptom_analysis: Optional[Dict[str, Any]] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        agent_state: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Build clinical context enriched with RAG knowledge retrieval.
        Searches the oncology knowledge base for passages relevant to the
        patient's message, then appends them to the standard clinical context.
        For generic replies (sim, não, ok), uses the last assistant message as query
        to maintain context coherence.
        """
        base_context = self.build(
            clinical_context=clinical_context,
            protocol=protocol,
            symptom_analysis=symptom_analysis,
            conversation_history=conversation_history,
            agent_state=agent_state,
        )

        cancer_type = self._extract_cancer_type(clinical_context)
        rag_query = self._rag_query_for_message(
            patient_message, conversation_history or []
        )
        passages = knowledge_rag.retrieve(query=rag_query, cancer_type=cancer_type)

        if passages:
            rag_block = knowledge_rag.format_context(passages)
            logger.info(
                f"RAG retrieved {len(passages)} passages "
                f"(top score: {passages[0]['score']:.3f})"
            )
            return f"{base_context}\n\n{rag_block}"

        return base_context

    def _rag_query_for_message(
        self, patient_message: str, conversation_history: List[Dict[str, str]]
    ) -> str:
        """
        Build RAG query. For generic confirmations (sim, não, ok), use the last
        assistant message to avoid retrieving irrelevant passages.
        """
        msg_lower = patient_message.strip().lower()
        if len(msg_lower) < 15 or msg_lower in self._GENERIC_REPLIES:
            for m in reversed(conversation_history):
                if m.get("role") == "assistant" and m.get("content"):
                    last_question = m["content"][:200].strip()
                    if last_question:
                        return f"{last_question} {patient_message}"
        return patient_message

    def _extract_cancer_type(self, clinical_context: Dict[str, Any]) -> Optional[str]:
        """Extract primary cancer type from clinical context for RAG filtering."""
        patient = clinical_context.get("patient", {})
        ct = patient.get("cancerType")
        if ct:
            return ct.upper()

        diagnoses = clinical_context.get("diagnoses", [])
        if diagnoses:
            return (diagnoses[0].get("cancerType") or "").upper()

        return None

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
        """Format active treatments — includes D+N calculation for neutropenia risk."""
        from datetime import datetime, timezone

        lines = ["### Tratamentos Ativos"]

        for tx in treatments[:5]:
            name = tx.get("treatmentName") or tx.get("treatmentType", "Não especificado")
            status = tx.get("status", "")
            line_num = tx.get("line")
            intent = tx.get("intent", "")

            detail = f"- **{name}**"
            if line_num:
                detail += f" ({line_num}ª linha)"
            if intent == "PALLIATIVE":
                detail += " [PALIATIVO]"
            if status:
                detail += f" - {status}"
            lines.append(detail)

            cycle = tx.get("currentCycle")
            total = tx.get("totalCycles")
            if cycle and total:
                lines.append(f"  Ciclo: {cycle}/{total}")
            elif cycle:
                lines.append(f"  Ciclo atual: {cycle}")

            # D+N calculation — critical for neutropenic nadir window (D7-D14)
            last_app = tx.get("lastApplicationDate") or tx.get("lastCycleDate")
            if last_app:
                try:
                    app_date = datetime.fromisoformat(
                        last_app.replace("Z", "+00:00")
                    ).replace(tzinfo=timezone.utc)
                    now = datetime.now(tz=timezone.utc)
                    days_post = (now - app_date).days
                    lines.append(f"  Última aplicação: {last_app[:10]} (D+{days_post})")

                    treatment_type = tx.get("treatmentType", "")
                    if treatment_type in ("CHEMOTHERAPY", "COMBINED"):
                        if 7 <= days_post <= 14:
                            lines.append(
                                "  ⚠️ **NADIR NEUTROPÊNICO ATIVO (D7-D14)** — "
                                "febre neste período = emergência hematológica"
                            )
                        elif days_post <= 21:
                            lines.append(
                                f"  ⚡ Janela de risco pós-quimio: D+{days_post} "
                                "(risco neutropênico até D+21)"
                            )
                except Exception:
                    lines.append(f"  Última aplicação: {last_app[:10]}")

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
        lines = [
            "### Etapas de Navegação Pendentes",
            "Importante: as datas abaixo são PRAZOS (data-meta para a etapa), NÃO significam agendamento confirmado.",
            "Use o nome exato de cada etapa. Ao falar com o paciente: diga que é um PRAZO e pergunte se já existe agendamento.",
            "",
        ]

        for step in steps[:10]:
            name = step.get("stepName", "Etapa")
            key = step.get("stepKey", "")
            status = step.get("status", "PENDING")
            due = step.get("dueDate")

            icon = "⏳" if status == "PENDING" else "🔄" if status == "IN_PROGRESS" else "⚠️"
            key_part = f" [chave: {key}]" if key else ""
            detail = f"- {icon} {name} ({status}){key_part}"
            if due:
                detail += f" - Prazo (não é agendamento): {due}"
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

    def _format_medications(self, medications: List[Dict]) -> str:
        """Format structured medications with clinical risk flags."""
        lines = ["### Medicamentos em Uso"]

        risk_meds = []
        regular_meds = []

        for med in medications:
            if not med.get("isActive", True):
                continue
            is_risky = any([
                med.get("isAnticoagulant"),
                med.get("isAntiplatelet"),
                med.get("isCorticosteroid"),
                med.get("isImmunosuppressant"),
                med.get("isOpioid"),
                med.get("isNSAID"),
            ])
            if is_risky:
                risk_meds.append(med)
            else:
                regular_meds.append(med)

        if risk_meds:
            lines.append("**⚠️ Com flags de risco clínico:**")
            for med in risk_meds[:8]:
                flags = []
                if med.get("isAnticoagulant") or med.get("isAntiplatelet"):
                    flags.append("ANTICOAGULANTE/ANTIPLAQUETÁRIO — qualquer sangramento é emergência")
                if med.get("isCorticosteroid"):
                    flags.append("CORTICOIDE — pode mascarar febre e infecção")
                if med.get("isImmunosuppressant"):
                    flags.append("IMUNOSSUPRESSOR — risco infeccioso aumentado")
                if med.get("isOpioid"):
                    flags.append("OPIOIDE — avaliar sedação e constipação")
                if med.get("isNSAID"):
                    flags.append("AINE — risco GI e renal")
                dosage = f" {med['dosage']}" if med.get("dosage") else ""
                freq = f" {med['frequency']}" if med.get("frequency") else ""
                lines.append(f"  - **{med['name']}**{dosage}{freq} → {'; '.join(flags)}")

        if regular_meds:
            lines.append("**Uso contínuo (sem flag de risco):**")
            med_list = []
            for med in regular_meds[:10]:
                parts = [med["name"]]
                if med.get("dosage"):
                    parts.append(med["dosage"])
                if med.get("frequency"):
                    parts.append(med["frequency"])
                med_list.append(" ".join(parts))
            lines.append(f"  {', '.join(med_list)}")

        return "\n".join(lines)

    def _format_comorbidities(self, comorbidities: List[Dict]) -> str:
        """Format structured comorbidities with risk flags."""
        lines = ["### Comorbidades"]

        high_risk = []
        regular = []

        for c in comorbidities:
            has_risk = any([
                c.get("increasesSepsisRisk"),
                c.get("increasesBleedingRisk"),
                c.get("increasesThrombosisRisk"),
                c.get("affectsRenalClearance"),
                c.get("affectsPulmonaryReserve"),
            ])
            if has_risk:
                high_risk.append(c)
            else:
                regular.append(c)

        if high_risk:
            lines.append("**Com impacto no risco clínico:**")
            for c in high_risk:
                flags = []
                if c.get("increasesSepsisRisk"):
                    flags.append("↑ risco de sepse")
                if c.get("increasesThrombosisRisk"):
                    flags.append("↑ risco trombótico")
                if c.get("affectsRenalClearance"):
                    flags.append("↓ clearance renal")
                if c.get("affectsPulmonaryReserve"):
                    flags.append("↓ reserva pulmonar")
                if c.get("increasesBleedingRisk"):
                    flags.append("↑ risco de sangramento")
                severity_pt = {"MILD": "Leve", "MODERATE": "Moderada", "SEVERE": "Grave"}.get(
                    c.get("severity", ""), c.get("severity", "")
                )
                controlled = "controlada" if c.get("controlled") else "não controlada"
                lines.append(
                    f"  - **{c['name']}** ({severity_pt}, {controlled}) → {'; '.join(flags)}"
                )

        if regular:
            names = [c["name"] for c in regular[:8]]
            lines.append(f"**Outras:** {', '.join(names)}")

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
