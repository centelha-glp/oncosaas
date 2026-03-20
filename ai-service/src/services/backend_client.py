"""
HTTP client for communication with the NestJS backend.

BACKEND_SERVICE_TOKEN is read lazily on each call (not at construction time) so
that this module can be imported before dotenv has loaded env vars.
"""
import asyncio
import httpx
import os
from datetime import datetime, timezone
from typing import Dict, Optional, List
import logging

logger = logging.getLogger(__name__)


class BackendClient:
    """Async HTTP client for NestJS backend side-effects (alerts, disposition, ECOG)."""

    def __init__(self):
        # base_url is stable at startup; token is read lazily so dotenv timing is irrelevant.
        self.base_url = os.getenv("BACKEND_URL", "http://localhost:3002")

    @property
    def _service_token(self) -> Optional[str]:
        """Read BACKEND_SERVICE_TOKEN from env on every call (lazy, dotenv-safe)."""
        return os.getenv("BACKEND_SERVICE_TOKEN") or None

    # ── Internal raw implementation ──────────────────────────────────────────

    async def _create_alert_raw(
        self,
        patient_id: str,
        alert_type: str,
        severity: str,
        message: str,
        context: Optional[Dict] = None,
        tenant_id: Optional[str] = None,
    ) -> Dict:
        """
        POST /api/v1/alerts — raises on any failure.

        Raises:
            httpx.HTTPStatusError: On 4xx/5xx responses.
            RuntimeError: If BACKEND_SERVICE_TOKEN is not configured.
            httpx.RequestError: On network/timeout errors.
        """
        token = self._service_token
        if not token:
            raise RuntimeError("BACKEND_SERVICE_TOKEN não configurado")

        url = f"{self.base_url}/api/v1/alerts"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        if tenant_id:
            headers["X-Tenant-Id"] = tenant_id

        payload: Dict = {
            "patientId": patient_id,
            "type": alert_type,
            "severity": severity,
            "message": message,
        }
        if context:
            payload["context"] = context

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            alert = response.json()
            logger.info("Alerta criado: %s", alert.get("id"))
            return alert

    # ── Public API ────────────────────────────────────────────────────────────

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
        Create an alert in the backend. Returns None on any failure (non-raising).

        For retry behaviour on transient errors use create_alert_with_retry().
        """
        try:
            return await self._create_alert_raw(
                patient_id=patient_id,
                alert_type=alert_type,
                severity=severity,
                message=message,
                context=context,
                tenant_id=tenant_id,
            )
        except RuntimeError as e:
            logger.error("Erro de configuração ao criar alerta: %s", e)
            return None
        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            if status == 404:
                logger.error("Paciente %s não encontrado", patient_id)
            elif status == 401:
                logger.error("Token de autenticação inválido")
            elif status == 403:
                logger.error("Sem permissão para criar alertas")
            else:
                logger.error("Erro HTTP %s ao criar alerta: %s", status, e.response.text)
            return None
        except Exception as e:
            logger.error("Erro ao criar alerta: %s", e)
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
        """Helper to create a CRITICAL_SYMPTOM alert with symptom metadata."""
        context: Dict = {
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
        Create an alert with exponential-backoff retry for transient errors.

        Retry policy:
        - 4xx errors (except 429): permanent failure — no retry.
        - 5xx errors and 429: transient — retry with 2^attempt second backoff.
        - Network/timeout errors: retry.
        - Missing token (RuntimeError): permanent failure — no retry.
        """
        for attempt in range(max_retries):
            try:
                return await self._create_alert_raw(
                    patient_id=patient_id,
                    alert_type=alert_type,
                    severity=severity,
                    message=message,
                    context=context,
                    tenant_id=tenant_id,
                )
            except RuntimeError:
                # Token not configured — no point retrying
                logger.error("BACKEND_SERVICE_TOKEN ausente — retry cancelado")
                return None
            except httpx.HTTPStatusError as e:
                status = e.response.status_code
                is_permanent = 400 <= status < 500 and status != 429
                if is_permanent:
                    logger.error("Erro permanente %s — sem retry", status)
                    return None
                # Transient (5xx / 429): fall through to retry logic below
                logger.warning(
                    "Tentativa %d/%d falhou (HTTP %s). Backoff...",
                    attempt + 1, max_retries, status,
                )
            except Exception as e:
                logger.warning(
                    "Tentativa %d/%d falhou (%s). Backoff...",
                    attempt + 1, max_retries, type(e).__name__,
                )

            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)

        logger.error("Alerta não criado após %d tentativas", max_retries)
        return None

    async def update_clinical_disposition(
        self,
        patient_id: str,
        disposition: str,
        reason: str,
        tenant_id: Optional[str] = None,
    ) -> Optional[Dict]:
        """
        Update the patient's clinical disposition in the backend.

        Args:
            disposition: One of REMOTE_NURSING | SCHEDULED_CONSULT | ADVANCE_CONSULT |
                         ER_DAYS | ER_IMMEDIATE
        """
        token = self._service_token
        if not token:
            logger.error("BACKEND_SERVICE_TOKEN não configurado")
            return None

        url = f"{self.base_url}/api/v1/patients/{patient_id}"
        headers = {
            "Authorization": f"Bearer {token}",
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
            logger.error("Erro ao atualizar disposição clínica: %s", e)
            return None

    async def record_performance_status(
        self,
        patient_id: str,
        ecog_score: int,
        tenant_id: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Optional[Dict]:
        """Record an ECOG performance status assessment from the agent."""
        token = self._service_token
        if not token:
            return None

        url = f"{self.base_url}/api/v1/patients/{patient_id}/performance-status"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        if tenant_id:
            headers["X-Tenant-Id"] = tenant_id

        payload: Dict = {"ecogScore": ecog_score, "source": "AGENT"}
        if notes:
            payload["notes"] = notes

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error("Erro ao registrar ECOG: %s", e)
            return None


# Global singleton — token is resolved lazily on each call
backend_client = BackendClient()
