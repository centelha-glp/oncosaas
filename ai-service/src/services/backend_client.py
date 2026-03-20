"""
Cliente HTTP para comunicação com o backend NestJS
"""
import httpx
import os
import asyncio
from typing import Dict, Optional, List
import logging

logger = logging.getLogger(__name__)


class BackendClient:
    """Cliente HTTP para comunicação com o backend NestJS"""

    def __init__(self):
        self.base_url = os.getenv("BACKEND_URL", "http://localhost:3002")
        self.service_token = os.getenv("BACKEND_SERVICE_TOKEN")
        
        if not self.service_token:
            logger.warning(
                "BACKEND_SERVICE_TOKEN não configurado. "
                "Alertas não poderão ser criados."
            )

    async def create_alert(
        self,
        patient_id: str,
        alert_type: str,
        severity: str,
        message: str,
        context: Optional[Dict] = None,
        tenant_id: Optional[str] = None,
    ) -> Optional[Dict]:
        """
        Cria um alerta no backend

        Args:
            patient_id: UUID do paciente
            alert_type: Tipo do alerta (ex: "CRITICAL_SYMPTOM")
            severity: Severidade (ex: "CRITICAL", "HIGH", "MEDIUM", "LOW")
            message: Mensagem descritiva do alerta
            context: Metadados adicionais (opcional)
            tenant_id: ID do tenant (se não fornecido, backend usa do token)

        Returns:
            Dict com o alerta criado ou None se erro
        """
        if not self.service_token:
            logger.error("BACKEND_SERVICE_TOKEN não configurado")
            return None

        url = f"{self.base_url}/api/v1/alerts"

        headers = {
            "Authorization": f"Bearer {self.service_token}",
            "Content-Type": "application/json",
        }

        # Se tenant_id fornecido, adicionar header (se backend suportar)
        if tenant_id:
            headers["X-Tenant-Id"] = tenant_id

        payload = {
            "patientId": patient_id,
            "type": alert_type,
            "severity": severity,
            "message": message,
        }

        if context:
            payload["context"] = context

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                alert = response.json()
                logger.info(f"✅ Alerta criado: {alert.get('id')}")
                return alert
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.error(f"❌ Paciente {patient_id} não encontrado")
            elif e.response.status_code == 401:
                logger.error("❌ Token de autenticação inválido")
            elif e.response.status_code == 403:
                logger.error("❌ Sem permissão para criar alertas")
            else:
                logger.error(f"❌ Erro HTTP {e.response.status_code}: {e.response.text}")
            return None
        except Exception as e:
            logger.error(f"❌ Erro ao criar alerta: {e}")
            return None

    async def create_critical_symptom_alert(
        self,
        patient_id: str,
        symptoms: List[str],
        message: str,
        conversation_id: Optional[str] = None,
        message_id: Optional[str] = None,
        confidence: float = 1.0,
        tenant_id: Optional[str] = None,
    ) -> Optional[Dict]:
        """
        Método helper para criar alerta de sintoma crítico

        Args:
            patient_id: UUID do paciente
            symptoms: Lista de sintomas detectados (ex: ["febre", "dispneia"])
            message: Mensagem descritiva
            conversation_id: ID da conversa (opcional)
            message_id: ID da mensagem que gerou o alerta (opcional)
            confidence: Confiança na detecção (0.0 a 1.0)
            tenant_id: ID do tenant (opcional)

        Returns:
            Dict com o alerta criado ou None se erro
        """
        context = {
            "symptoms": symptoms,
            "detectedBy": "ai_agent",
            "confidence": confidence,
        }

        if conversation_id:
            context["conversationId"] = conversation_id
        if message_id:
            context["messageId"] = message_id

        return await self.create_alert(
            patient_id=patient_id,
            alert_type="CRITICAL_SYMPTOM",
            severity="CRITICAL",
            message=message,
            context=context,
            tenant_id=tenant_id,
        )

    async def create_alert_with_retry(
        self,
        patient_id: str,
        alert_type: str,
        severity: str,
        message: str,
        context: Optional[Dict] = None,
        max_retries: int = 3,
        tenant_id: Optional[str] = None,
    ) -> Optional[Dict]:
        """
        Cria alerta com retry automático em caso de erro do servidor

        Args:
            patient_id: UUID do paciente
            alert_type: Tipo do alerta
            severity: Severidade
            message: Mensagem descritiva
            context: Metadados adicionais
            max_retries: Número máximo de tentativas
            tenant_id: ID do tenant

        Returns:
            Dict com o alerta criado ou None se erro após todas as tentativas
        """
        for attempt in range(max_retries):
            try:
                alert = await self.create_alert(
                    patient_id=patient_id,
                    alert_type=alert_type,
                    severity=severity,
                    message=message,
                    context=context,
                    tenant_id=tenant_id,
                )
                if alert:
                    return alert
            except httpx.HTTPStatusError as e:
                # Erros 4xx não devem ser retentados (exceto 429)
                if 400 <= e.response.status_code < 500 and e.response.status_code != 429:
                    logger.error(f"❌ Erro do cliente: {e.response.status_code}")
                    return None
                # Erros 5xx e 429 devem ser retentados
                elif attempt < max_retries - 1:
                    wait_time = 2 ** attempt  # Backoff exponencial
                    logger.warning(
                        f"⚠️ Tentativa {attempt + 1}/{max_retries} falhou. "
                        f"Tentando novamente em {wait_time}s..."
                    )
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    logger.error(f"❌ Erro ao criar alerta após {max_retries} tentativas")
                    return None
            except Exception as e:
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    logger.warning(
                        f"⚠️ Erro inesperado na tentativa {attempt + 1}. "
                        f"Tentando novamente em {wait_time}s..."
                    )
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    logger.error(f"❌ Erro inesperado após {max_retries} tentativas: {e}")
                    return None

        return None


    async def update_clinical_disposition(
        self,
        patient_id: str,
        disposition: str,
        reason: str,
        tenant_id: Optional[str] = None,
    ) -> Optional[Dict]:
        """
        Updates the patient's clinical disposition (output of the risk algorithm).

        Args:
            patient_id: Patient UUID
            disposition: One of REMOTE_NURSING | SCHEDULED_CONSULT | ADVANCE_CONSULT |
                         ER_DAYS | ER_IMMEDIATE
            reason: Human-readable clinical reasoning
            tenant_id: Tenant ID

        Returns:
            Updated patient data or None on error
        """
        if not self.service_token:
            logger.error("BACKEND_SERVICE_TOKEN não configurado")
            return None

        from datetime import datetime, timezone

        url = f"{self.base_url}/api/v1/patients/{patient_id}"
        headers = {
            "Authorization": f"Bearer {self.service_token}",
            "Content-Type": "application/json",
        }
        if tenant_id:
            headers["X-Tenant-Id"] = tenant_id

        payload = {
            "clinicalDisposition": disposition,
            "clinicalDispositionAt": datetime.now(tz=timezone.utc).isoformat(),
            "clinicalDispositionReason": reason,
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.patch(url, json=payload, headers=headers)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"❌ Erro ao atualizar disposição clínica: {e}")
            return None

    async def record_performance_status(
        self,
        patient_id: str,
        ecog_score: int,
        tenant_id: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Optional[Dict]:
        """Records an ECOG assessment from the agent."""
        if not self.service_token:
            return None

        url = f"{self.base_url}/api/v1/patients/{patient_id}/performance-status"
        headers = {
            "Authorization": f"Bearer {self.service_token}",
            "Content-Type": "application/json",
        }
        if tenant_id:
            headers["X-Tenant-Id"] = tenant_id

        payload = {"ecogScore": ecog_score, "source": "AGENT"}
        if notes:
            payload["notes"] = notes

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"❌ Erro ao registrar ECOG: {e}")
            return None


# Instância global do cliente
backend_client = BackendClient()

