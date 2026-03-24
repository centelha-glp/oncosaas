"""
Tests for BackendClient — token behaviour, retry decision logic.
"""
import pytest
import httpx
from unittest.mock import AsyncMock, MagicMock, patch
from src.services.backend_client import BackendClient


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
