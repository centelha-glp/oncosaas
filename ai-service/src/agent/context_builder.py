"""
Clinical Context Builder (RAG).
Builds formatted clinical context from patient data for the LLM system prompt.
Integrates with the oncology knowledge RAG for evidence-based responses.
"""

from typing import Dict, List, Optional, Any, Literal, Tuple
import logging

from .rag import knowledge_rag

logger = logging.getLogger(__name__)

# Papel do subagente para `build_slice` — texto no mesmo formato `###` que `build()`.
SubAgentClinicalContextRole = Literal[
    "navigation",
    "symptom",
    "questionnaire",
    "emotional_support",
    "scheduling_secretary",
]

# Últimas mensagens do diálogo no contexto estruturado (user/assistant); ~1 linha cada.
_RECENT_DIALOGUE_MAX_MESSAGES = 5
_RECENT_DIALOGUE_MAX_CHARS = 180
_LAYER1_REASONING_MAX_CHARS = 600


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
        layer1_clinical_rules: Optional[Any] = None,
    ) -> str:
        """
        Build formatted clinical context string for the system prompt.

        Args:
            clinical_context: Full patient clinical data from backend
            protocol: Active clinical protocol for cancer type
            symptom_analysis: Current symptom analysis results
            conversation_history: Recent conversation messages
            agent_state: Agent state with last_symptoms, last_symptom_severity
            layer1_clinical_rules: Resultado do motor de regras (Layer 1) deste turno, se aplicável

        Returns:
            Formatted string for inclusion in the system prompt
        """
        sections = []

        if agent_state and agent_state.get("last_symptoms"):
            severity = agent_state.get("last_symptom_severity", "LOW")
            symptoms = ", ".join(s.get("name", "?") for s in agent_state["last_symptoms"])
            sections.append(
                f"### TÓPICO EM DISCUSSÃO (prioridade sobre etapas de navegação)\n"
                f"O paciente está discutindo sintoma(s): **{symptoms}** "
                f"[{severity}]. Conclua esse tópico antes de falar de exames ou agendamentos."
            )
        _, symptom_topic_active = self._symptom_topic_navigation_flags(agent_state)

        dialogue_block = self._format_recent_dialogue_snippets(conversation_history or [])
        if dialogue_block:
            sections.append(dialogue_block)

        aq_block = self._format_active_questionnaire(agent_state)
        if aq_block:
            sections.append(aq_block)

        patient = clinical_context.get("patient", {})
        if patient:
            sections.append(self._format_patient_data(patient))

        layer1_block = self._format_layer1_turn_triage(layer1_clinical_rules, symptom_analysis)
        if layer1_block:
            sections.append(layer1_block)

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

    def build_slice(
        self,
        role: SubAgentClinicalContextRole,
        clinical_context: Dict[str, Any],
        _protocol: Optional[Dict[str, Any]] = None,
        _symptom_analysis: Optional[Dict[str, Any]] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        agent_state: Optional[Dict[str, Any]] = None,
        _layer1_clinical_rules: Optional[Any] = None,
    ) -> str:
        """
        Contexto clínico reduzido por papel de subagente (mesmos `###` que `build()`).

        O orquestrador principal continua a usar só `build()` completo. Slices evitam
        enviar observações/protocolo/diálogo inteiro a subagentes que não precisam.

        Os parâmetros `protocol`, `symptom_analysis` e `layer1_clinical_rules` existem por
        simetria com `build()` e para evoluções futuras; nas combinações actuais podem
        não ser usados.

        Papéis não mapeados no pedido de produto:
        - `emotional_support`: paciente mínimo + diálogo recente (tom empático sem PHI extra).
        - `scheduling_secretary`: igual a `navigation` (etapas + paciente mínimo); tools síncronas
          usam backend via executor, não este texto.
        """
        sections: List[str] = []
        patient = clinical_context.get("patient") or {}
        _, nav_placeholder = self._symptom_topic_navigation_flags(agent_state)

        if role == "navigation" or role == "scheduling_secretary":
            minimal = self._format_patient_minimal(patient)
            if minimal:
                sections.append(minimal)
            nav_steps = clinical_context.get("navigationSteps", [])
            if nav_steps:
                if nav_placeholder:
                    sections.append(
                        "### Etapas de Navegação\n"
                        "(Omitidas neste turno — concluir discussão do sintoma antes de mencionar exames ou agendamentos.)"
                    )
                else:
                    sections.append(self._format_navigation_steps(nav_steps))
            return self._join_sections(sections)

        if role == "symptom":
            if agent_state and agent_state.get("last_symptoms"):
                severity = agent_state.get("last_symptom_severity", "LOW")
                symptoms = ", ".join(s.get("name", "?") for s in agent_state["last_symptoms"])
                sections.append(
                    f"### TÓPICO EM DISCUSSÃO (prioridade sobre etapas de navegação)\n"
                    f"O paciente está discutindo sintoma(s): **{symptoms}** "
                    f"[{severity}]. Conclua esse tópico antes de falar de exames ou agendamentos."
                )
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
            alerts = clinical_context.get("recentAlerts", [])
            if alerts:
                sections.append(self._format_recent_alerts(alerts))
            return self._join_sections(sections)

        if role == "questionnaire":
            aq_block = self._format_active_questionnaire(agent_state)
            if aq_block:
                sections.append(aq_block)
            qr = clinical_context.get("questionnaireResponses", [])
            if qr:
                sections.append(self._format_questionnaire_history(qr))
            return self._join_sections(sections)

        if role == "emotional_support":
            minimal = self._format_patient_minimal(patient)
            if minimal:
                sections.append(minimal)
            dialogue_block = self._format_recent_dialogue_snippets(conversation_history or [])
            if dialogue_block:
                sections.append(dialogue_block)
            return self._join_sections(sections)

        logger.warning("build_slice: unknown role %s — returning empty marker", role)
        return self._join_sections(sections)

    @staticmethod
    def _join_sections(sections: List[str]) -> str:
        return "\n\n".join(sections) if sections else "Contexto clínico não disponível."

    @staticmethod
    def _symptom_topic_navigation_flags(
        agent_state: Optional[Dict[str, Any]],
    ) -> Tuple[bool, bool]:
        """
        Returns:
            (topic_section_relevant, use_nav_placeholder)
        """
        if not agent_state or not agent_state.get("last_symptoms"):
            return False, False
        severity = agent_state.get("last_symptom_severity", "LOW")
        topic = True
        nav_placeholder = severity in ("HIGH", "CRITICAL")
        return topic, nav_placeholder

    _GENERIC_REPLIES = frozenset({"sim", "não", "nao", "ok", "é", "eh", "isso", "exato", "correto", "verdade", "isso mesmo"})

    def build_with_rag(
        self,
        patient_message: str,
        clinical_context: Dict[str, Any],
        protocol: Optional[Dict[str, Any]] = None,
        symptom_analysis: Optional[Dict[str, Any]] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        agent_state: Optional[Dict[str, Any]] = None,
        layer1_clinical_rules: Optional[Any] = None,
    ) -> str:
        """
        Legado / testes: monta `build()` e acrescenta passagens do corpus.

        O caminho principal do orquestrador **não** usa este método: o contexto
        estruturado vem só de `build()`; o Opus obtém trechos educativos via a tool
        `buscar_conhecimento_oncologico` quando necessário.
        """
        base_context = self.build(
            clinical_context=clinical_context,
            protocol=protocol,
            symptom_analysis=symptom_analysis,
            conversation_history=conversation_history,
            agent_state=agent_state,
            layer1_clinical_rules=layer1_clinical_rules,
        )

        cancer_type = self.extract_cancer_type_for_rag(clinical_context)
        rag_query = self.rag_query_for_message(
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

    def rag_query_for_message(
        self, patient_message: str, conversation_history: List[Dict[str, str]]
    ) -> str:
        """
        Monta a query de retrieval. Para confirmações genéricas (sim, não, ok),
        usa a última mensagem do assistente para manter coerência com o turno.
        """
        msg_lower = patient_message.strip().lower()
        if len(msg_lower) < 15 or msg_lower in self._GENERIC_REPLIES:
            for m in reversed(conversation_history):
                if m.get("role") == "assistant" and m.get("content"):
                    last_question = m["content"][:200].strip()
                    if last_question:
                        return f"{last_question} {patient_message}"
        return patient_message

    def extract_cancer_type_for_rag(
        self, clinical_context: Dict[str, Any]
    ) -> Optional[str]:
        """Tipo de câncer primário do contexto clínico (filtro do RAG), em maiúsculas."""
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
        if patient.get("age") is not None:
            lines.append(f"- **Idade**: {patient['age']} anos")

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

        disp = patient.get("clinicalDisposition")
        if disp:
            lines.append(f"- **Disposição clínica (registro no prontuário)**: {disp}")
            reason = patient.get("clinicalDispositionReason")
            if reason:
                r = str(reason).strip()
                if len(r) > 400:
                    r = r[:397] + "..."
                lines.append(f"  - Motivo registrado: {r}")
            at = patient.get("clinicalDispositionAt")
            if at:
                lines.append(f"  - Registrada em: {at}")

        return "\n".join(lines)

    def _format_patient_minimal(self, patient: Dict) -> Optional[str]:
        """Paciente reduzido para subagentes (navegação / secretária / suporte emocional)."""
        if not patient:
            return None
        lines = ["### Dados do Paciente (resumo)"]
        pid = patient.get("id")
        if pid:
            lines.append(f"- **ID**: {pid}")
        lines.append(f"- **Nome**: {patient.get('name', 'Não informado')}")
        if patient.get("age") is not None:
            lines.append(f"- **Idade**: {patient['age']} anos")
        if patient.get("cancerType"):
            lines.append(f"- **Tipo de câncer**: {patient['cancerType']}")
        if patient.get("currentStage"):
            lines.append(f"- **Etapa da jornada**: {patient['currentStage']}")
        return "\n".join(lines)

    def _role_label_pt(self, role: str) -> str:
        r = (role or "").lower()
        if r in ("user", "patient"):
            return "Paciente"
        if r in ("assistant", "agent"):
            return "Assistente"
        if r == "nursing":
            return "Enfermagem"
        return role or "?"

    def _format_recent_dialogue_snippets(
        self, conversation_history: List[Dict[str, Any]]
    ) -> Optional[str]:
        """Últimas mensagens em ordem cronológica, texto curto por linha."""
        if not conversation_history:
            return None
        tail = conversation_history[-_RECENT_DIALOGUE_MAX_MESSAGES:]
        lines_out: List[str] = ["### Diálogo recente (resumo)"]
        for m in tail:
            role = self._role_label_pt(str(m.get("role", "")))
            content = (m.get("content") or "").strip().replace("\n", " ")
            if not content:
                continue
            if len(content) > _RECENT_DIALOGUE_MAX_CHARS:
                content = content[: _RECENT_DIALOGUE_MAX_CHARS - 1] + "…"
            lines_out.append(f"- **{role}**: {content}")
        return "\n".join(lines_out) if len(lines_out) > 1 else None

    def _format_active_questionnaire(
        self, agent_state: Optional[Dict[str, Any]]
    ) -> Optional[str]:
        """Secção legível quando há ESAS/PRO-CTCAE em curso (tipo, passo, pergunta atual)."""
        if not agent_state:
            return None
        aq = agent_state.get("active_questionnaire")
        if not isinstance(aq, dict) or not aq:
            return None
        q_type = aq.get("type") or "desconhecido"
        items = aq.get("items") or []
        idx = int(aq.get("currentIndex") or 0)
        total = len(items)
        step_label = f"{idx + 1}/{total}" if total else str(idx + 1)
        current_q = ""
        try:
            from .questionnaire_engine import questionnaire_engine

            current_q = (questionnaire_engine.get_current_question(aq) or "").strip()
        except Exception as exc:
            logger.warning("active_questionnaire preview failed: %s", exc)
        lines = [
            "### Questionário ativo",
            "- **Roteamento (orquestrador)**: entre domínios em conflito, o questionário fica **por último** na ordem de prioridade — **não** suspenda triagem de sintomas urgentes nem ignore foco explícito seguro do paciente em outros temas.",
            f"- **Tipo**: {q_type}",
            f"- **Passo atual**: {step_label}",
        ]
        if current_q:
            cap = 420
            short = current_q[:cap] + ("…" if len(current_q) > cap else "")
            lines.append(f"- **Pergunta ao paciente**: {short}")
        return "\n".join(lines)

    def _format_layer1_turn_triage(
        self, layer1: Any, symptom_analysis: Optional[Dict[str, Any]]
    ) -> Optional[str]:
        """Layer 1 deste turno (regras determinísticas) + resumo da análise de sintomas."""
        if layer1 is None:
            return None
        disposition = getattr(layer1, "disposition", None)
        if not disposition:
            return None
        reasoning = (getattr(layer1, "reasoning", None) or "").strip()
        if len(reasoning) > _LAYER1_REASONING_MAX_CHARS:
            reasoning = reasoning[: _LAYER1_REASONING_MAX_CHARS - 1] + "…"

        findings = getattr(layer1, "findings", None) or []
        rule_ids: List[str] = []
        for f in findings[:12]:
            rid = getattr(f, "rule_id", None) or (f.get("rule_id") if isinstance(f, dict) else None)
            if rid:
                rule_ids.append(str(rid))

        lines = [
            "### Triagem deste turno (Layer 1 — regras determinísticas)",
            f"- **Disposição**: {disposition}",
        ]
        if rule_ids:
            lines.append(f"- **Regras disparadas (IDs)**: {', '.join(rule_ids)}")
        if reasoning:
            lines.append(f"- **Síntese do raciocínio**: {reasoning}")

        if symptom_analysis:
            names = [
                s.get("name")
                for s in (symptom_analysis.get("detectedSymptoms") or [])
                if isinstance(s, dict) and s.get("name")
            ]
            overall = symptom_analysis.get("overallSeverity")
            esc = bool(symptom_analysis.get("requiresEscalation"))
            extra: List[str] = []
            if names:
                extra.append(f"sintomas detectados: {', '.join(names[:8])}")
            if overall:
                extra.append(f"severidade geral: {overall}")
            if esc:
                extra.append("requer escalação: sim")
            if extra:
                lines.append("- **Análise de sintomas (mensagem atual)**: " + "; ".join(extra))

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
