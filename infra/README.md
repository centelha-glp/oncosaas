# OncoSaaS Terraform Infra

This folder provisions production baseline infrastructure for OncoSaaS:

- EC2 app host (`t3.large`) running Docker Compose
- PostgreSQL RDS with 50GB allocated storage
- ECR repositories for backend/frontend/ai-service
- GitHub OIDC deploy role ARN output
- SSM parameters for runtime secrets and release pointers
- CloudWatch alarms for host and deployment health

## Terraform State

This setup currently uses Terraform's default local backend (local state file in this directory).

Initialize with:

```bash
terraform init
```

## Apply

```bash
terraform fmt
terraform validate
terraform plan -out tfplan
terraform apply tfplan
```
