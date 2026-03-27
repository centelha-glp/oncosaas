data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-arm64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

locals {
  ecr_registry = split("/", aws_ecr_repository.backend.repository_url)[0]

  user_data = templatefile("${path.module}/userdata.sh.tftpl", {
    project          = var.project
    environment      = var.environment
    aws_region       = var.aws_region
    app_url          = var.app_url
    ecr_registry     = local.ecr_registry
    db_username      = var.db_master_username
    db_name          = var.db_name
    db_host          = aws_db_instance.postgres.address
    db_password_path = aws_ssm_parameter.db_master_password.name
    ssh_public_key   = var.ssh_public_key
  })
}

resource "aws_instance" "app" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.app.id]
  associate_public_ip_address = true
  key_name                    = var.key_name
  iam_instance_profile        = aws_iam_instance_profile.ec2.name
  user_data                   = local.user_data
  user_data_replace_on_change = true

  metadata_options {
    http_tokens                 = "required"
    http_endpoint               = "enabled"
    http_put_response_hop_limit = 1
  }

  root_block_device {
    encrypted   = true
    volume_type = "gp3"
    volume_size = 50
  }

  tags = {
    Name = "${var.project}-${var.environment}-app"
  }
}
