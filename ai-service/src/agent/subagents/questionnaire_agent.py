"""
Clinical Questionnaire Subagent.

Specializes in deciding when and which clinical questionnaire (ESAS or PRO-CTCAE)
should be initiated, and triggers priority recalculation after clinical data collection.
"""

from typing import Any, Dict, List

from ..prompts.action_tools import AGENT_ACTION_TOOLS
from .base_subagent import BaseSubAgent

_TOOL_NAMES = {"iniciar_questionario", "recalcular_prioridade"}
_TOOLS = [t for t in AGENT_ACTION_TOOLS if t["name"] in _TOOL_NAMES]

_SYSTEM_PROMPT = """# Agente de Questionários Clínicos

Você é um agente especialista em avaliação clínica estruturada para pacientes oncológicos.
Sua função é decidir quando iniciar questionários clínicos padronizados e acionar
o recálculo de prioridade quando dados clínicos forem coletados.

## QUESTIONÁRIOS DISPONÍVEIS

### ESAS (Edmonton Symptom Assessment System)
- Avalia 9 dimensões de sintomas: dor, fadiga, náusea, depressão, ansiedade,
  sonolência, apetite, bem-estar e dispneia
- Use quando: múltiplos sintomas vagos, avaliação periódica de qualidade de vida,
  paciente relata piora geral sem sintoma específico dominante

### PRO-CTCAE (Patient-Reported Outcomes - Common Terminology Criteria for Adverse Events)
- Avalia toxicidades específicas de tratamento oncológico
- Use quando: efeitos colaterais de quimioterapia/radioterapia/imunoterapia,
  acompanhamento de toxicidades conhecidas, pós-ciclo de quimioterapia

## CRITÉRIOS PARA INICIAR QUESTIONÁRIO

**Iniciar ESAS quando:**
- Paciente relata fadiga, náusea, dor ou depressão sem especificar detalhes
- Avaliação periódica programada (7-14 dias sem questionário)
- Múltiplos sintomas difusos e inespecíficos

**Iniciar PRO-CTCAE quando:**
- Paciente está em tratamento ativo (quimioterapia, imunoterapia, terapia alvo)
- Efeitos colaterais específicos do tratamento (mucosite, neuropatia, síndrome mão-pé)
- Pós-ciclo de quimioterapia (1-3 dias após)

## RECÁLCULO DE PRIORIDADE
Use `recalcular_prioridade` SEMPRE que:
- Um questionário for iniciado (dados serão coletados)
- Dados clínicos relevantes foram registrados
- Há mudança significativa no quadro clínico

## INSTRUÇÃO
Analise o contexto clínico e determine se um questionário é apropriado neste momento.
Se sim, selecione o tipo correto e inicie. Acione recálculo de prioridade conforme necessário."""


class QuestionnaireAgent(BaseSubAgent):
    """Specialized agent for clinical questionnaire management."""

    name = "questionnaire_agent"

    @property
    def system_prompt(self) -> str:
        return _SYSTEM_PROMPT

    @property
    def tools(self) -> List[Dict[str, Any]]:
        return _TOOLS
