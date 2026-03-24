# INFRA Hardening Runbook

This document tracks the last successful infrastructure implementation steps for the EC2+Compose hardening initiative.

## Infra repo provisions

- VPC (1 public subnet for EC2, 2 private subnets for RDS)
- EC2 (Ubuntu 24.04 arm64, public IP)
- RDS Postgres (private, SG only from EC2)
- ECR repo
- SSM Parameter for DB password (SecureString)
- IAM:
  - EC2 instance role: SSM + ECR pull + read SSM parameter
  - GitHub OIDC deploy role: ECR push + SSM send-command to that instance

## Service repo pipeline

- Build linux/arm64 Docker image
- Push to ECR with tag = commit SHA
- Use SSM AWS-RunShellScript to run a deploy script on EC2:
- Pull image
- Update /etc/app/app.env with IMAGE_URI
- Restart application

Infra repo structure
```
infra/
  terraform/
    providers.tf
    variables.tf
    network.tf
    security_groups.tf
    rds.tf
    iam.tf
    ec2.tf
    userdata.sh.tftpl
    outputs.tf
    terraform.tfvars
```

## Step 1 - Create Terraform Root Structure (Successful)

### Objective
Create a dedicated Terraform root under `oncosaas/infra` with a remote-state-ready layout and production IaC baseline files.

### Exact Commands Run
```bash
mkdir -p /Users/pedrofernandes/stuff/onco/oncosaas/infra
```

### Files Changed
- `infra/providers.tf`
- `infra/backend.tf`
- `infra/backend.hcl.example`
- `infra/variables.tf`
- `infra/network.tf`
- `infra/security_groups.tf`
- `infra/ecr.tf`
- `infra/iam.tf`
- `infra/rds.tf`
- `infra/ec2.tf`
- `infra/observability.tf`
- `infra/outputs.tf`
- `infra/terraform.tfvars.example`
- `infra/README.md`

### Terraform Outputs Used
No outputs consumed in this step. Outputs were defined for downstream usage:
- `ec2_instance_id`
- `ec2_public_ip`
- `rds_endpoint`
- `ecr_registry`
- `backend_repo_url`
- `frontend_repo_url`
- `ai_service_repo_url`
- `github_deploy_role_arn`
- `runtime_ssm_prefix`

### Verification Evidence
- `git status --short` shows new `infra/` folder tracked in working tree.
- Manual file inspection confirms all required Terraform domains are present (`providers`, `backend`, `network`, `security_groups`, `iam`, `ecr`, `ec2`, `rds`, `variables`, `outputs`).

### Rollback Commands
```bash
rm -rf /Users/pedrofernandes/stuff/onco/oncosaas/infra
```

### Caveats
- Remote backend is configured as `backend "s3" {}` and requires external `backend.hcl` values before `terraform init`. (Removed)

---

## Step 2 - Provision EC2 Bootstrap + Runtime Secrets Flow (Successful)

### Objective
Add host bootstrap and deterministic deployment scripts via EC2 `user_data`, plus SSM SecureString parameters for runtime secrets and release pointers.

### Exact Commands Run
```bash
cat > /Users/pedrofernandes/stuff/onco/oncosaas/infra/ssm.tf <<'EOF' ... EOF
cat > /Users/pedrofernandes/stuff/onco/oncosaas/infra/userdata.sh.tftpl <<'EOF' ... EOF
```

### Files Changed
- `infra/ssm.tf`
- `infra/userdata.sh.tftpl`

### Terraform Outputs Used
Defined for deployment wiring in scripts:
- `ecr_registry`
- `runtime_ssm_prefix`

### Verification Evidence
- Inspected full rendered template and confirmed presence of:
- `/opt/oncosaas/scripts/sync-runtime-env.sh`
- `/opt/oncosaas/scripts/deploy.sh`
- preflight checks (disk/memory + `docker compose config`)
- health checks (`backend`, `ai-service`, `frontend`)
- rollback to SSM `last_known_good`
- CloudWatch deploy metrics emission

### Rollback Commands
```bash
git checkout -- /Users/pedrofernandes/stuff/onco/oncosaas/infra/ssm.tf \
  /Users/pedrofernandes/stuff/onco/oncosaas/infra/userdata.sh.tftpl
```

### Caveats
- User-data generated compose file references `latest` by default; deploy script overrides effective release through explicit pull by immutable tag before restart.

---

## Step 3 - Switch GitHub Deploy to OIDC + SSM (Successful)

### Objective
Replace static AWS key auth with GitHub OIDC role assumption and deploy through AWS SSM command execution.

### Exact Commands Run
```bash
cat > /Users/pedrofernandes/stuff/onco/oncosaas/.github/workflows/deploy.yml <<'EOF' ... EOF
```

### Files Changed
- `.github/workflows/deploy.yml`

### Terraform Outputs Used
Expected to be exported to GitHub Variables after apply:
- `github_deploy_role_arn` -> set as `AWS_ROLE_TO_ASSUME`
- `ec2_instance_id` -> set as `EC2_INSTANCE_ID`
- `ecr_registry` can be derived or set directly from output

### Verification Evidence
- Workflow now includes:
- `permissions: id-token: write`
- `aws-actions/configure-aws-credentials@v4` with `role-to-assume`
- Deploy step using `aws ssm send-command` to run `sudo /opt/oncosaas/scripts/deploy.sh <registry> <sha>`
- Wait/assert stage via `aws ssm wait command-executed`

### Rollback Commands
```bash
git checkout -- /Users/pedrofernandes/stuff/onco/oncosaas/.github/workflows/deploy.yml
```

### Caveats
- Repository/environment must define GitHub Variables:
- `AWS_REGION`
- `AWS_ACCOUNT_ID`
- `APP_URL`
- `AWS_ROLE_TO_ASSUME`
- `EC2_INSTANCE_ID`

---

## Step 4 - Harden Git Ignore for Terraform State Artifacts (Successful)

### Objective
Prevent accidental local Terraform state/plan artifacts and local backend config from being committed.

### Exact Commands Run
```bash
apply_patch (update .gitignore)
```

### Files Changed
- `.gitignore`

### Terraform Outputs Used
None.

### Verification Evidence
- `.gitignore` now includes:
- `*.tfstate`
- `*.tfstate.*`
- `.terraform/`
- `.terraform.lock.hcl`
- `backend.hcl`
- `tfplan`

### Rollback Commands
```bash
git checkout -- /Users/pedrofernandes/stuff/onco/oncosaas/.gitignore
```

### Caveats
- `backend.hcl.example` remains versioned and should be used as template only.

---

## Step 5 - Run Terraform Verification Commands (Successful with documented limitation)

### Objective
Validate local Terraform formatting and attempt provider initialization/validation.

### Exact Commands Run
```bash
terraform version
terraform fmt -check
terraform fmt
terraform fmt -check
terraform init -backend=false
terraform validate
```

### Files Changed
- `infra/iam.tf` (formatted by `terraform fmt`)

### Terraform Outputs Used
None.

### Verification Evidence
- `terraform version` succeeded: `Terraform v1.14.7`.
- `terraform fmt -check` initially failed (`iam.tf`), then passed after formatting.
- `terraform init -backend=false` failed due network/DNS restriction to `registry.terraform.io` in the current environment.
- `terraform validate` failed because required providers could not be installed without init.

### Rollback Commands
```bash
git checkout -- /Users/pedrofernandes/stuff/onco/oncosaas/infra/iam.tf
```

### Caveats
- To complete full validation, run in an environment with outbound access to `registry.terraform.io` and then execute:
```bash
terraform init -backend-config=backend.hcl
terraform validate
terraform plan -out tfplan
```

---

## Current Open Follow-ups
1. Apply Terraform in AWS account with production values (`terraform.tfvars`, `backend.hcl`).
2. Export Terraform outputs to GitHub Environment Variables.
3. Confirm EC2 IAM role has SSM and ECR read access as configured.
4. Trigger a test deploy from `main` and verify health-gated rollback behavior.
5. Configure CloudWatch alarm destinations (SNS/PagerDuty/email), not included in this iteration.

---

## Step 6 - Extract GitHub OIDC Trust to Dedicated Infra File (Successful)

### Objective
Create a dedicated Terraform file for GitHub -> AWS OIDC trust so the infra repo owns the deploy role definition and the service repo only references `AWS_ROLE_TO_ASSUME`.

### Exact Commands Run
```bash
apply_patch (remove GitHub OIDC resources from infra/iam.tf)
apply_patch (add infra/github_oidc.tf)
terraform fmt
terraform fmt -check
```

### Files Changed
- `infra/iam.tf`
- `infra/github_oidc.tf`
- `infra/terraform.tfvars` (format-only change from `terraform fmt`)

### Terraform Outputs Used
No outputs consumed in this step. Existing output remains unchanged:
- `github_deploy_role_arn`

### Verification Evidence
- `infra/github_oidc.tf` now contains:
- `aws_iam_openid_connect_provider.github`
- `aws_iam_role.github_deploy`
- `aws_iam_policy.github_deploy`
- `aws_iam_role_policy_attachment.github_deploy_attach`
- `infra/iam.tf` now contains only EC2 runtime IAM resources.
- `terraform fmt -check` passes.

### Rollback Commands
```bash
git checkout -- /Users/pedrofernandes/stuff/onco/oncosaas/infra/iam.tf \
  /Users/pedrofernandes/stuff/onco/oncosaas/infra/github_oidc.tf \
  /Users/pedrofernandes/stuff/onco/oncosaas/infra/terraform.tfvars
```

### Caveats
- Trust policy is constrained to `repo:${var.github_repo}:ref:refs/heads/${var.github_branch}`.
- The service repo must set `AWS_ROLE_TO_ASSUME` from Terraform output `github_deploy_role_arn`.

---

## Step 7 - Fix RDS Master Password Character Set (Successful)

### Objective
Resolve RDS provisioning failure caused by generated password containing characters not accepted by `MasterUserPassword`.

### Exact Commands Run
```bash
apply_patch (update infra/rds.tf random_password.db_master)
terraform fmt
```

### Files Changed
- `infra/rds.tf`

### Terraform Outputs Used
None.

### Verification Evidence
- Updated `random_password.db_master` to `special = false` in `infra/rds.tf`.
- `terraform fmt` completed successfully.
- This removes forbidden characters from generated passwords and aligns with RDS constraints.

### Rollback Commands
```bash
git checkout -- /Users/pedrofernandes/stuff/onco/oncosaas/infra/rds.tf
```

### Caveats
- This change only affects newly generated passwords.
- If state already contains a disallowed password and apply was partially executed, run:
```bash
terraform taint random_password.db_master
terraform apply
```
(or remove `random_password.db_master` from state and re-apply) to force regeneration.

---

## Step 8 - Keep Special Characters with RDS-Safe Password Set (Successful)

### Objective
Allow special characters in the RDS master password while respecting AWS RDS password restrictions.

### Exact Commands Run
```bash
apply_patch (update infra/rds.tf)
terraform fmt
terraform validate
```

### Files Changed
- `infra/rds.tf`
- `infra/outputs.tf` (format-only change from `terraform fmt`)

### Terraform Outputs Used
None.

### Verification Evidence
- `random_password.db_master` now keeps specials with `override_special` restricted to RDS-safe characters.
- RDS password assignment now uses `random_password.db_master.result` directly.
- `db_url` now uses `urlencode(random_password.db_master.result)` so special chars are safely encoded for connection strings.

### Rollback Commands
```bash
git checkout -- /Users/pedrofernandes/stuff/onco/oncosaas/infra/rds.tf \
  /Users/pedrofernandes/stuff/onco/oncosaas/infra/outputs.tf
```

### Caveats
- `terraform validate` is currently blocked by local provider plugin runtime issues in this environment (plugin handshake failure), unrelated to the password logic change.

---

## Step 9 - Investigate Prepauto Password Behavior and Apply No-Charset-Override RDS Fix (Successful)

### Objective
Determine why `prepauto` worked without explicit password charset restrictions and fix `oncosaas` so RDS accepts generated passwords while keeping special characters and default random charset behavior.

### Exact Commands Run
```bash
sed -n '1,240p' oncosaas/infra/rds.tf
sed -n '1,320p' oncosaas/infra/userdata.sh.tftpl
sed -n '1,260p' prepauto/infra/rds.tf
sed -n '1,320p' prepauto/infra/userdata.sh.tftpl
rg -n "decode|base64|jsondecode|urldecode|tostring|nonsensitive|master_password|db_master" oncosaas/infra prepauto/infra
cd oncosaas/infra && jq -r '.resources[] | select(.type=="random_password" and .name=="db_master") | .instances[0].attributes.result' terraform.tfstate
cd prepauto/infra && jq -r '.resources[] | select(.type=="random_password" and .name=="db_master") | .instances[0].attributes.result' terraform.tfstate
apply_patch (update oncosaas/infra/rds.tf)
apply_patch (update oncosaas/infra/userdata.sh.tftpl)
cat > oncosaas/infra/backend.tf
cat > oncosaas/infra/backend.hcl.example
cd oncosaas/infra && terraform fmt
cd oncosaas/infra && terraform fmt -check
cd oncosaas/infra && RAW=$(jq -r '.resources[] | select(.type=="random_password" and .name=="db_master") | .instances[0].attributes.result' terraform.tfstate); SAFE=$(printf '%s' "$RAW" | sed 's/@/_/g; s#/#-#g; s/"/./g; s/ /+/g'); printf 'raw=%s\nsanitized=%s\n' "$RAW" "$SAFE"
```

### Files Changed
- `infra/rds.tf`
- `infra/userdata.sh.tftpl`
- `infra/backend.tf`
- `infra/backend.hcl.example`

### Terraform Outputs Used
No outputs consumed in this step.

### Verification Evidence
- `oncosaas` state password sample contained forbidden `@`:
  - `raw=tcJ4+)RM8IDYIHu@#_NGmT#?`
- `prepauto` state password sample had no forbidden RDS characters:
  - `0ojW-P0tdL3Rht+y_rlA:M#-`
- Conclusion: `prepauto` success came from generated-value luck, not decode behavior differences.
- `rds.tf` now keeps default `special = true` and normalizes only forbidden chars (`@`, `/`, `"`, space) before using password in:
  - `aws_db_instance.postgres.password`
  - `aws_ssm_parameter.db_master_password.value`
  - `aws_ssm_parameter.db_url.value` (still URL-encoded)
- `userdata.sh.tftpl` now URL-encodes DB password before building `DATABASE_URL`, preventing runtime parsing errors when special chars are present.
- `terraform fmt -check` passes.

### Rollback Commands
```bash
git checkout -- /Users/pedrofernandes/stuff/onco/oncosaas/infra/rds.tf \
  /Users/pedrofernandes/stuff/onco/oncosaas/infra/userdata.sh.tftpl \
  /Users/pedrofernandes/stuff/onco/oncosaas/infra/backend.tf \
  /Users/pedrofernandes/stuff/onco/oncosaas/infra/backend.hcl.example
```

### Caveats
- Password normalization maps forbidden chars to allowed replacements, so the final RDS password can differ from the raw generated value.
- Existing failed `aws_db_instance.postgres` create attempts may need a fresh apply after updating password logic.
- `terraform validate` remains blocked in this local environment by provider plugin handshake/runtime issues.

---

---

## Step 12 - Fix Cloud-Init Failure Risk in Compose Template (Successful)

### Objective
Prevent EC2 user-data from failing during bootstrap by ensuring `IMAGE_TAG` and `ECR_REGISTRY` placeholders in Compose are preserved literally and only resolved at deploy/runtime.

### Exact Commands Run
```bash
apply_patch (update oncosaas/infra/userdata.sh.tftpl)
rg -n "docker-compose.prod.yml|image: .*ECR_REGISTRY|<<'COMPOSE'|<<COMPOSE" oncosaas/infra/userdata.sh.tftpl
cd oncosaas/infra && terraform fmt -check
```

### Files Changed
- `infra/userdata.sh.tftpl`

### Terraform Outputs Used
None.

### Verification Evidence
- Compose heredoc is now literal: `<<'COMPOSE'`.
- Image lines now use literal runtime placeholders:
  - `${ECR_REGISTRY}/oncosaas-backend:${IMAGE_TAG}`
  - `${ECR_REGISTRY}/oncosaas-frontend:${IMAGE_TAG}`
  - `${ECR_REGISTRY}/oncosaas-ai-service:${IMAGE_TAG}`
- `terraform fmt -check` passes.
- This removes early shell expansion risk under `set -u` during cloud-init bootstrap.

### Rollback Commands
```bash
git checkout -- /Users/pedrofernandes/stuff/onco/oncosaas/infra/userdata.sh.tftpl
```

### Caveats
- Existing instances keep previously rendered `/opt/oncosaas/current/docker-compose.prod.yml` until refreshed/reprovisioned or replaced manually.
