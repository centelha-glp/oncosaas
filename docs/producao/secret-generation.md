# Secret Generation Guide

## Required Secrets

### JWT_SECRET

Used to sign and verify JWT tokens. Must be long and random.

```bash
openssl rand -base64 48
# Example output: 3k9mN2pQ7rX1vY8wZ4aB6cD0eF5gH2iJ3kL9mN2pQ7rX1vY8wZ4aB==
```

Set in your `.env` file:

```
JWT_SECRET=<output from above>
```

### ENCRYPTION_KEY

Used for AES-256-GCM encryption of sensitive data (e.g. WhatsApp tokens). Must be exactly 32 bytes.

```bash
# Option 1: 32 random hex characters (32 chars = 32 bytes when used as UTF-8 string)
openssl rand -hex 16

# Option 2: 32-byte base64 string trimmed to 32 chars
openssl rand -base64 32 | tr -d '\n' | head -c 32
```

Set in your `.env` file:

```
ENCRYPTION_KEY=<32-character string>
```

### NEXTAUTH_SECRET (opcional)

O produto ONCONAV usa **JWT emitido pelo Nest** em cookies HttpOnly (ver [`README.md`](../../README.md)). **NextAuth.js não é o fluxo principal.** Só defina `NEXTAUTH_SECRET` (e variáveis NextAuth) se existir rota/handler NextAuth ativo no frontend.

```bash
openssl rand -base64 48
```

### BACKEND_SERVICE_TOKEN

Internal token for ai-service → backend communication.

```bash
openssl rand -hex 32
```

## Rotation Policy

- **JWT_SECRET**: Rotate every 90 days, or immediately if suspected compromise. Rotation invalidates all active sessions.
- **ENCRYPTION_KEY**: Requires data re-encryption. Do not rotate without a migration plan.
- **Database passwords**: Rotate every 180 days.

## GitHub Actions configuration

Use GitHub only for CI/CD and deployment transport credentials.

### GitHub Secrets (sensitive CI/CD values)

Add these under **Settings → Secrets and variables → Actions**:

| Secret Name             | Description                       | How to generate         |
| ----------------------- | --------------------------------- | ----------------------- |
| `AWS_ACCESS_KEY_ID`     | AWS deployment credentials        | AWS IAM console         |
| `AWS_SECRET_ACCESS_KEY` | AWS deployment credentials        | AWS IAM console         |
| `EC2_HOST`              | EC2 instance hostname/IP          | AWS EC2 console         |
| `EC2_USER`              | SSH user                          | e.g. `ec2-user`         |
| `EC2_SSH_KEY`           | SSH private key for deploy access | `ssh-keygen -t ed25519` |

### GitHub Variables (non-sensitive environment config)

Add these under **Settings → Secrets and variables → Actions → Variables**:

| Variable Name    | Description            | Example                   |
| ---------------- | ---------------------- | ------------------------- |
| `AWS_ACCOUNT_ID` | AWS account number     | `123456789012`            |
| `AWS_REGION`     | AWS region             | `sa-east-1`               |
| `APP_URL`        | Production public URL  | `https://yourdomain.com`  |

### Do not keep app runtime secrets in GitHub

Store these in **AWS Secrets Manager** (preferred for secrets/rotation) or **SSM Parameter Store** (config + secure strings), and load them on EC2 at deploy/startup time:

- `DATABASE_URL`
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `NEXTAUTH_SECRET`
- `RABBITMQ_DEFAULT_PASS`
- `ALLOWED_ORIGINS`
- `CORS_ORIGINS`
