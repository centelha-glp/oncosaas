variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "sa-east-1"
}

variable "project" {
  description = "Project prefix"
  type        = string
  default     = "oncosaas"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "github_repo" {
  description = "GitHub repo in owner/repo format"
  type        = string
}

variable "github_branch" {
  description = "GitHub branch allowed to deploy"
  type        = string
  default     = "main"
}

variable "vpc_cidr" {
  description = "VPC CIDR"
  type        = string
  default     = "10.60.0.0/16"
}

variable "public_subnet_cidr" {
  description = "Public subnet CIDR"
  type        = string
  default     = "10.60.10.0/24"
}

variable "private_subnet_cidrs" {
  description = "Private subnets for RDS"
  type        = list(string)
  default     = ["10.60.20.0/24", "10.60.30.0/24"]
}

variable "availability_zones" {
  description = "AZs used by public/private subnets"
  type        = list(string)
  default     = ["sa-east-1a", "sa-east-1b"]
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.large"
}

variable "allow_ssh" {
  description = "Whether to open SSH ingress"
  type        = bool
  default     = false
}

variable "admin_cidr" {
  description = "Admin CIDR for optional SSH ingress"
  type        = string
  default     = "0.0.0.0/32"
}

variable "key_name" {
  description = "Optional EC2 key pair"
  type        = string
  default     = null
}

variable "app_url" {
  description = "Public URL for frontend"
  type        = string
  default     = "https://oncosaas.example.com"
}

variable "db_name" {
  description = "RDS database name"
  type        = string
  default     = "oncosaas"
}

variable "db_master_username" {
  description = "RDS master username"
  type        = string
  default     = "oncosaas_admin"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.medium"
}

variable "db_allocated_storage_gb" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 50
}

variable "db_backup_retention_days" {
  description = "RDS backup retention"
  type        = number
  default     = 7
}

variable "ssh_public_key" {
  description = "Optional SSH public key content to append to ubuntu authorized_keys"
  type        = string
  default     = ""
}
