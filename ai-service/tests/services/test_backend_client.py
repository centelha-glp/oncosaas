"""
Tests for BackendClient — token behaviour, retry decision logic.
"""
import hashlib
import hmac
import pytest
import httpx
from unittest.mock import AsyncMock, MagicMock, patch
from src.services.backend_client import (
    BackendClient,
    internal_consultation_availability_payload,
    missing_internal_availability_fields,
)


@pytest.fixture()
def client():
    return BackendClient()


class TestServiceToken:

    def test_token_is_none_when_env_var_absent(self, client, monkeypatch):
        monkeypatch.delenv("BACKEND_SERVICE_TOKEN", raising=False)
        assert client._service_token is None

    def test_token_returns_value_when_env_var_set(self, client, monkeypatch):
        monkeypatch.setenv("BACKEND_SERVICE_TOKEN", "test-token-abc")
        assert client._service_token == "test-token-abc"

    def test_token_is_property_not_cached(self, client, monkeypatch):
        """Token is read lazily on each access — not cached at construction."""
        monkeypatch.delenv("BACKEND_SERVICE_TOKEN", raising=False)
        assert client._service_token is None
        monkeypatch.setenv("BACKEND_SERVICE_TOKEN", "new-token-xyz")
        assert client._service_token == "new-token-xyz"

    def test_base_url_and_tls_verify_are_read_lazily(self, client, monkeypatch):
        monkeypatch.setenv("BACKEND_URL", "https://localhost:3002/")
        monkeypatch.setenv("BACKEND_TLS_VERIFY", "false")

        assert client._base_url == "https://localhost:3002"
        assert client._tls_verify is False

        monkeypatch.setenv("BACKEND_TLS_VERIFY", "true")
        assert client._tls_verify is True

    def test_service_headers_include_tenant_hmac(self, client, monkeypatch):
        monkeypatch.setenv("BACKEND_SERVICE_TOKEN", "test-token")
        headers = client._service_headers("tenant-1")

        assert headers["Authorization"] == "Bearer test-token"
        assert headers["X-Tenant-Id"] == "tenant-1"
        assert headers["X-Tenant-Auth"] == hmac.new(
            b"test-token",
            b"tenant-1",
            hashlib.sha256,
        ).hexdigest()


class TestConsultationAvailability:
    def test_internal_availability_payload_normalizes_step_key_and_drops_extras(self):
        payload = internal_consultation_availability_payload(
            {
                "scheduledProfessionalId": "550e8400-e29b-41d4-a716-446655440000",
                "stepKey": "retorno_oncologia",
                "from": "2026-06-01T00:00:00.000Z",
                "to": "2026-06-02T00:00:00.000Z",
                "motivo": "paciente quer oncologista",
                "preferredDate": "2026-06-01T12:00:00.000Z",
            }
        )

        assert payload == {
            "professionalId": "550e8400-e29b-41d4-a716-446655440000",
            "stepKey": "specialist_consultation",
            "from": "2026-06-01T00:00:00.000Z",
            "to": "2026-06-02T00:00:00.000Z",
        }

    def test_missing_internal_availability_fields_requires_professional_and_step(self):
        assert missing_internal_availability_fields(
            {
                "stepKey": "oncologista",
                "from": "2026-06-01T00:00:00.000Z",
                "to": "2026-06-02T00:00:00.000Z",
            }
        ) == ["professionalId"]
        assert missing_internal_availability_fields(
            {
                "scheduledProfessionalId": "550e8400-e29b-41d4-a716-446655440000",
                "from": "2026-06-01T00:00:00.000Z",
                "to": "2026-06-02T00:00:00.000Z",
            }
        ) == ["stepKey"]

    @pytest.mark.asyncio
    async def test_posts_to_internal_agent_endpoint_with_short_timeout(
        self, client, monkeypatch
    ):
        monkeypatch.setenv("BACKEND_SERVICE_TOKEN", "test-token")
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "slots": ["2026-06-01T12:00:00.000Z"],
        }

        with patch("httpx.AsyncClient") as mock_http:
            mock_ctx = AsyncMock()
            mock_http.return_value.__aenter__ = AsyncMock(return_value=mock_ctx)
            mock_http.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_ctx.post = AsyncMock(return_value=mock_response)

            result = await client.get_consultation_availability(
                tenant_id="tenant-1",
                payload={
                    "scheduledProfessionalId": "550e8400-e29b-41d4-a716-446655440000",
                    "stepKey": "retorno_oncologia",
                    "from": "2026-06-01T00:00:00.000Z",
                    "to": "2026-06-02T00:00:00.000Z",
                    "motivo": "texto livre não deve ir ao backend interno",
                },
            )

        assert result["slots"] == ["2026-06-01T12:00:00.000Z"]
        mock_http.assert_called_once_with(timeout=5.0, verify=client._tls_verify)
        url = mock_ctx.post.call_args.args[0]
        assert url.endswith("/api/v1/agent/internal/consultation-availability")
        headers = mock_ctx.post.call_args.kwargs["headers"]
        assert headers["X-Tenant-Id"] == "tenant-1"
        assert headers["X-Tenant-Auth"] == hmac.new(
            b"test-token",
            b"tenant-1",
            hashlib.sha256,
        ).hexdigest()
        assert mock_ctx.post.call_args.kwargs["json"] == {
            "professionalId": "550e8400-e29b-41d4-a716-446655440000",
            "stepKey": "specialist_consultation",
            "from": "2026-06-01T00:00:00.000Z",
            "to": "2026-06-02T00:00:00.000Z",
        }

    @pytest.mark.asyncio
    async def test_raises_on_http_error(self, client, monkeypatch):
        monkeypatch.setenv("BACKEND_SERVICE_TOKEN", "test-token")
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Unauthorized", request=MagicMock(), response=mock_response
        )

        with patch("httpx.AsyncClient") as mock_http:
            mock_ctx = AsyncMock()
            mock_http.return_value.__aenter__ = AsyncMock(return_value=mock_ctx)
            mock_http.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_ctx.post = AsyncMock(return_value=mock_response)

            with pytest.raises(httpx.HTTPStatusError):
                await client.get_consultation_availability(
                    tenant_id="tenant-1",
                    payload={
                        "professionalId": "550e8400-e29b-41d4-a716-446655440000",
                        "stepKey": "navigation_consultation",
                        "from": "2026-06-01T00:00:00.000Z",
                        "to": "2026-06-02T00:00:00.000Z",
                    },
                )

    @pytest.mark.asyncio
    async def test_raises_on_timeout(self, client, monkeypatch):
        monkeypatch.setenv("BACKEND_SERVICE_TOKEN", "test-token")

        with patch("httpx.AsyncClient") as mock_http:
            mock_ctx = AsyncMock()
            mock_http.return_value.__aenter__ = AsyncMock(return_value=mock_ctx)
            mock_http.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_ctx.post = AsyncMock(side_effect=httpx.ReadTimeout("timed out"))

            with pytest.raises(httpx.ReadTimeout):
                await client.get_consultation_availability(
                    tenant_id="tenant-1",
                    payload={
                        "professionalId": "550e8400-e29b-41d4-a716-446655440000",
                        "stepKey": "navigation_consultation",
                        "from": "2026-06-01T00:00:00.000Z",
                        "to": "2026-06-02T00:00:00.000Z",
                    },
                    timeout_seconds=2.0,
                )
            mock_http.assert_called_once_with(timeout=2.0, verify=client._tls_verify)

    @pytest.mark.asyncio
    async def test_does_not_post_when_internal_payload_is_incomplete(
        self, client, monkeypatch
    ):
        monkeypatch.setenv("BACKEND_SERVICE_TOKEN", "test-token")
        with patch("httpx.AsyncClient") as mock_http:
            with pytest.raises(ValueError, match="professionalId"):
                await client.get_consultation_availability(
                    tenant_id="tenant-1",
                    payload={
                        "stepKey": "oncologista",
                        "from": "2026-06-01T00:00:00.000Z",
                        "to": "2026-06-02T00:00:00.000Z",
                    },
                )
        mock_http.assert_not_called()


class TestConsultationProfessionals:
    @pytest.mark.asyncio
    async def test_lists_internal_consultation_professionals_with_normalized_step(
        self, client, monkeypatch
    ):
        monkeypatch.setenv("BACKEND_SERVICE_TOKEN", "test-token")
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "professionals": [{"id": "u-1", "name": "Dra Onco"}],
        }

        with patch("httpx.AsyncClient") as mock_http:
            mock_ctx = AsyncMock()
            mock_http.return_value.__aenter__ = AsyncMock(return_value=mock_ctx)
            mock_http.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_ctx.post = AsyncMock(return_value=mock_response)

            result = await client.list_consultation_professionals(
                tenant_id="tenant-1",
                step_key="oncologista",
            )

        assert result["professionals"] == [{"id": "u-1", "name": "Dra Onco"}]
        url = mock_ctx.post.call_args.args[0]
        assert url.endswith("/api/v1/agent/internal/consultation-professionals")
        assert mock_ctx.post.call_args.kwargs["json"] == {
            "stepKey": "specialist_consultation",
        }


class TestCreateAlert:

    @pytest.mark.asyncio
    async def test_returns_none_when_token_absent(self, client, monkeypatch):
        monkeypatch.delenv("BACKEND_SERVICE_TOKEN", raising=False)
        result = await client.create_alert(
            patient_id="p1",
            alert_type="TEST",
            severity="LOW",
            message="test",
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_404(self, client, monkeypatch):
        monkeypatch.setenv("BACKEND_SERVICE_TOKEN", "test-token")
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Not Found", request=MagicMock(), response=mock_response
        )

        with patch("httpx.AsyncClient") as mock_http:
            mock_ctx = AsyncMock()
            mock_http.return_value.__aenter__ = AsyncMock(return_value=mock_ctx)
            mock_http.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_ctx.post = AsyncMock(return_value=mock_response)
            result = await client.create_alert(
                patient_id="p1",
                alert_type="TEST",
                severity="LOW",
                message="test",
            )
        assert result is None


class TestCreateAlertWithRetry:

    @pytest.mark.asyncio
    async def test_no_retry_on_404(self, client, monkeypatch):
        """404 is a permanent client error — should not retry."""
        monkeypatch.setenv("BACKEND_SERVICE_TOKEN", "test-token")
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Not Found", request=MagicMock(), response=mock_response
        )

        call_count = 0

        async def mock_post(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            return mock_response

        with patch("httpx.AsyncClient") as mock_http:
            mock_ctx = AsyncMock()
            mock_http.return_value.__aenter__ = AsyncMock(return_value=mock_ctx)
            mock_http.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_ctx.post = mock_post
            result = await client.create_alert_with_retry(
                patient_id="p1",
                alert_type="TEST",
                severity="LOW",
                message="test",
                max_retries=3,
            )

        assert result is None
        assert call_count == 1  # Only one attempt — 404 is permanent

    @pytest.mark.asyncio
    async def test_returns_none_when_token_absent(self, client, monkeypatch):
        monkeypatch.delenv("BACKEND_SERVICE_TOKEN", raising=False)
        result = await client.create_alert_with_retry(
            patient_id="p1",
            alert_type="TEST",
            severity="LOW",
            message="test",
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_retries_on_503(self, client, monkeypatch):
        """503 is a transient error — should retry up to max_retries."""
        monkeypatch.setenv("BACKEND_SERVICE_TOKEN", "test-token")
        mock_response = MagicMock()
        mock_response.status_code = 503
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Service Unavailable", request=MagicMock(), response=mock_response
        )

        call_count = 0

        async def mock_post(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            return mock_response

        with patch("httpx.AsyncClient") as mock_http:
            mock_ctx = AsyncMock()
            mock_http.return_value.__aenter__ = AsyncMock(return_value=mock_ctx)
            mock_http.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_ctx.post = mock_post
            with patch("asyncio.sleep", new_callable=AsyncMock):
                result = await client.create_alert_with_retry(
                    patient_id="p1",
                    alert_type="TEST",
                    severity="LOW",
                    message="test",
                    max_retries=3,
                )

        assert result is None
        assert call_count == 3  # All 3 retries attempted
