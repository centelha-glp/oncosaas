"""
Agente conversacional de IA para WhatsApp
"""

from typing import Dict, List, Optional
from openai import OpenAI
from anthropic import Anthropic
import logging
import os


class WhatsAppAgent:
    """
    Agente conversacional que interage com pacientes via WhatsApp
    """
    
    def __init__(
        self,
        provider: str = "openai",  # "openai" ou "anthropic"
        model: str = "gpt-4",
    ):
        self.provider = provider
        self.model = model
        self.client = None
        self.disabled_reason: Optional[str] = None
        self.logger = logging.getLogger(__name__)
        
        if provider == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                self.disabled_reason = "OPENAI_API_KEY não configurada"
                self.logger.warning(
                    "OPENAI_API_KEY não configurada. "
                    "O agente WhatsApp vai responder com mensagens mockadas."
                )
            else:
                self.client = OpenAI(api_key=api_key)
        elif provider == "anthropic":
            api_key = os.getenv("ANTHROPIC_API_KEY")
            if not api_key:
                self.disabled_reason = "ANTHROPIC_API_KEY não configurada"
                self.logger.warning(
                    "ANTHROPIC_API_KEY não configurada. "
                    "O agente WhatsApp vai responder com mensagens mockadas."
                )
            else:
                self.client = Anthropic(api_key=api_key)
        else:
            raise ValueError(f"Provider não suportado: {provider}")
    
    def _is_llm_available(self) -> bool:
        return self.client is not None
    
    def _get_system_prompt(self, patient_context: Dict) -> str:
        """
        Gera prompt do sistema baseado no contexto do paciente
        
        Args:
            patient_context: Contexto do paciente (nome, tipo de câncer, etc.)
            
        Returns:
            Prompt do sistema
        """
        return f"""Você é um assistente virtual de saúde que conversa com pacientes oncológicos via WhatsApp.

OBJETIVOS:
1. Coletar informações sobre sintomas e qualidade de vida de forma conversacional
2. Detectar sintomas críticos que necessitam atenção imediata
3. Ser empático, claro e respeitoso

REGRAS:
- Use linguagem simples e acessível
- Faça perguntas uma de cada vez
- Se detectar sintoma crítico, ALERTE IMEDIATAMENTE
- Não faça diagnósticos ou prescrições
- Sempre pergunte sobre febre se paciente mencionar mal-estar

SINTOMAS CRÍTICOS (alertar imediatamente):
- Febre >38°C
- Dispneia severa
- Sangramento ativo
- Dor intensa (8-10/10)
- Náuseas/vômitos persistentes
- Sinais de infecção

CONTEXTO DO PACIENTE:
Nome: {patient_context.get('name', 'Paciente')}
Tipo de câncer: {patient_context.get('cancer_type', 'Não especificado')}
Tratamento atual: {patient_context.get('treatment', 'Não especificado')}
"""
    
    def process_message(
        self,
        message: str,
        patient_context: Dict,
        conversation_history: List[Dict],
    ) -> Dict:
        """
        Processa mensagem do paciente e retorna resposta do agente
        
        Args:
            message: Mensagem do paciente
            patient_context: Contexto do paciente
            conversation_history: Histórico de conversa
            
        Returns:
            Dict com resposta, dados estruturados e alertas
        """
        system_prompt = self._get_system_prompt(patient_context)
        
        # Construir histórico de mensagens
        messages = [{"role": "system", "content": system_prompt}]
        
        for msg in conversation_history:
            messages.append({
                "role": msg["role"],  # "user" ou "assistant"
                "content": msg["content"]
            })
        
        # Adicionar mensagem atual
        messages.append({"role": "user", "content": message})
        
        # Detectar sintomas críticos
        critical_symptoms = self._detect_critical_symptoms(message)
        
        # Extrair dados estruturados
        structured_data = self._extract_structured_data(message)

        if not self._is_llm_available():
            agent_response = self._fallback_response(patient_context, message)
            return {
                "response": agent_response,
                "critical_symptoms": critical_symptoms,
                "structured_data": structured_data,
                "should_alert": len(critical_symptoms) > 0,
                "llm_available": False,
            }
        
        # Chamar LLM
        if self.provider == "openai":
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=500,
            )
            agent_response = response.choices[0].message.content
        else:  # anthropic
            response = self.client.messages.create(
                model=self.model,
                max_tokens=500,
                messages=messages,
            )
            agent_response = response.content[0].text
        
        return {
            "response": agent_response,
            "critical_symptoms": critical_symptoms,
            "structured_data": structured_data,
            "should_alert": len(critical_symptoms) > 0,
            "llm_available": True,
        }

    def _fallback_response(self, patient_context: Dict, message: str) -> str:
        """
        Retorna resposta segura ao paciente quando o LLM não está disponível.
        Não expõe detalhes técnicos internos.
        """
        name = patient_context.get("name", "paciente")
        self.logger.warning(
            "LLM indisponível — respondendo com mensagem de fallback para %s. "
            "Configure ANTHROPIC_API_KEY ou OPENAI_API_KEY para habilitar o agente.",
            name,
        )
        return (
            f"Olá {name}! Sua mensagem foi recebida com sucesso e foi registrada "
            f"em nosso sistema.\n\n"
            f"Nossa equipe de enfermagem será notificada e entrará em contato em breve. "
            f"Caso seja uma emergência, ligue imediatamente para o número de urgência "
            f"do seu hospital."
        )
    
    def _detect_critical_symptoms(self, message: str) -> List[str]:
        """
        Detecta sintomas críticos na mensagem
        
        Args:
            message: Mensagem do paciente
            
        Returns:
            Lista de sintomas críticos detectados
        """
        message_lower = message.lower()
        critical_symptoms = []
        
        critical_keywords = {
            'febre': ['febre', 'febril', 'temperatura alta', 'calafrio'],
            'dispneia': ['falta de ar', 'não consigo respirar', 'sufocando'],
            'sangramento': ['sangrando', 'sangue', 'hemorragia'],
            'dor_intensa': ['dor muito forte', 'dor 10', 'dor insuportável'],
            'vomito': ['vomitando muito', 'não paro de vomitar'],
        }
        
        for symptom, keywords in critical_keywords.items():
            if any(keyword in message_lower for keyword in keywords):
                critical_symptoms.append(symptom)
        
        return critical_symptoms
    
    def _extract_structured_data(self, message: str) -> Dict:
        """
        Extrai dados estruturados da mensagem (sintomas, escalas)
        
        Args:
            message: Mensagem do paciente
            
        Returns:
            Dict com dados estruturados
        """
        # Implementação básica - pode ser melhorada com LLM function calling
        structured_data = {
            "symptoms": {},
            "scales": {},
        }
        
        # Detectar escala de dor (0-10)
        import re
        pain_pattern = r'dor[^\d]*(\d+)[^\d]*10'
        pain_match = re.search(pain_pattern, message.lower())
        if pain_match:
            pain_score = int(pain_match.group(1))
            structured_data["symptoms"]["pain"] = pain_score
        
        return structured_data


# Instância global do agente
whatsapp_agent = WhatsAppAgent()


