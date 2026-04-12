# Production Security Checklist

Complete this checklist before every production deployment.

## Secrets & Credentials

- [ ] `JWT_SECRET` is set and has at least 32 bytes of entropy
  - Generate: `openssl rand -base64 48`
- [ ] `ENCRYPTION_KEY` is set and is exactly 32 bytes
  - Generate: `openssl rand -hex 16` (produces 32 hex chars = 16 bytes) OR `openssl rand -base64 24 | head -c 32`
- [ ] `NEXTAUTH_SECRET` is set
  - Generate: `openssl rand -base64 48`
- [ ] `BACKEND_SERVICE_TOKEN` is set for internal service auth
- [ ] Database password (`POSTGRES_PASSWORD`) is not the default `ONCONAV_dev`
- [ ] RabbitMQ password (`RABBITMQ_DEFAULT_PASS`) is not the default `ONCONAV_dev`

## CORS Configuration

- [ ] `ALLOWED_ORIGINS` env var is set in backend with the production domain(s)
  - Example: `ALLOWED_ORIGINS=https://yourdomain.com`
- [ ] `CORS_ORIGINS` env var is set in ai-service with the production domain(s)
  - Example: `CORS_ORIGINS=https://yourdomain.com,https://api.yourdomain.com`
- [ ] No hardcoded IP addresses or domains appear in source code

## TLS / HTTPS

- [ ] `DOMAIN` env var is set for Caddy (e.g. `DOMAIN=yourdomain.com`)
- [ ] HSTS header is active (already in Caddyfile — verify response headers)
- [ ] Certificate auto-renewal is working (Caddy handles this automatically)

## Environment Variables

- [ ] `NODE_ENV=production` is set for backend and frontend
- [ ] `FRONTEND_URL` is set to the production frontend URL
- [ ] `AI_SERVICE_URL` is set to the internal ai-service URL
- [ ] `BACKEND_URL` is set in ai-service to the internal backend URL

## AI Service

- [ ] At least one of `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is set
  - Without this, the agent returns mock responses only
- [ ] `BACKEND_SERVICE_TOKEN` is set on the ai-service container/process (backend calls require `Authorization: Bearer`)
- [ ] Optional: `AI_SERVICE_REQUIRE_SERVICE_TOKEN=true` in staging/pre-prod to reject startup-style misconfiguration (503 if token unset), matching production strictness

## Deployment Verification

- [ ] Health check passes: `curl https://yourdomain.com/api/v1/health`
- [ ] Auth endpoints work: login returns a JWT token
- [ ] CORS headers are correct: response includes `Access-Control-Allow-Origin` for your domain
- [ ] Logs show no `JWT_SECRET` or `ENCRYPTION_KEY` warnings
