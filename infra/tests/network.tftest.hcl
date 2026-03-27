# Testes de infraestrutura de rede
# Valida VPC, subnets, internet gateway e tabela de rotas

mock_provider "aws" {
  mock_data "aws_ami" {
    defaults = {
      id           = "ami-0mock00000000000a"
      architecture = "arm64"
    }
  }
}

mock_provider "random" {}

variables {
  github_repo = "centelha-glp/oncosaas"
}

# ---------------------------------------------------------------------------
# VPC
# ---------------------------------------------------------------------------

run "vpc_tem_dns_habilitado" {
  command = plan

  assert {
    condition     = aws_vpc.main.enable_dns_support == true
    error_message = "VPC deve ter DNS support habilitado"
  }

  assert {
    condition     = aws_vpc.main.enable_dns_hostnames == true
    error_message = "VPC deve ter DNS hostnames habilitado"
  }
}

run "vpc_cidr_padrao" {
  command = plan

  assert {
    condition     = aws_vpc.main.cidr_block == "10.60.0.0/16"
    error_message = "VPC CIDR padrão deve ser 10.60.0.0/16"
  }
}

run "vpc_cidr_customizado" {
  command = plan

  variables {
    vpc_cidr = "10.99.0.0/16"
  }

  assert {
    condition     = aws_vpc.main.cidr_block == "10.99.0.0/16"
    error_message = "VPC deve aceitar CIDR customizado"
  }
}

# ---------------------------------------------------------------------------
# Internet Gateway
# ---------------------------------------------------------------------------

run "igw_associado_a_vpc" {
  command = plan

  assert {
    condition     = aws_internet_gateway.igw.vpc_id == aws_vpc.main.id
    error_message = "Internet Gateway deve estar associado à VPC principal"
  }
}

# ---------------------------------------------------------------------------
# Subnets
# ---------------------------------------------------------------------------

run "subnet_publica_mapeia_ip_publico" {
  command = plan

  assert {
    condition     = aws_subnet.public.map_public_ip_on_launch == true
    error_message = "Subnet pública deve mapear IP público automaticamente"
  }
}

run "subnet_publica_cidr_padrao" {
  command = plan

  assert {
    condition     = aws_subnet.public.cidr_block == "10.60.10.0/24"
    error_message = "Subnet pública deve ter CIDR padrão 10.60.10.0/24"
  }
}

run "subnet_publica_usa_primeira_az" {
  command = plan

  assert {
    condition     = aws_subnet.public.availability_zone == var.availability_zones[0]
    error_message = "Subnet pública deve usar a primeira AZ da lista"
  }
}

run "duas_subnets_privadas_criadas" {
  command = plan

  assert {
    condition     = length(aws_subnet.private) == 2
    error_message = "Devem ser criadas 2 subnets privadas para o RDS"
  }
}

run "subnets_privadas_em_azs_distintas" {
  command = plan

  assert {
    condition = (
      aws_subnet.private[0].availability_zone != aws_subnet.private[1].availability_zone
    )
    error_message = "Subnets privadas devem estar em AZs distintas para alta disponibilidade do RDS"
  }
}

run "subnets_privadas_na_mesma_vpc" {
  command = plan

  assert {
    condition     = aws_subnet.private[0].vpc_id == aws_vpc.main.id
    error_message = "Subnets privadas devem estar na VPC principal"
  }
}

# ---------------------------------------------------------------------------
# Tabela de Rotas
# ---------------------------------------------------------------------------

run "rota_publica_aponta_para_igw" {
  command = plan

  assert {
    condition     = aws_route.public_internet.destination_cidr_block == "0.0.0.0/0"
    error_message = "Rota padrão deve ter destino 0.0.0.0/0"
  }

  assert {
    condition     = aws_route.public_internet.gateway_id == aws_internet_gateway.igw.id
    error_message = "Rota padrão deve apontar para o Internet Gateway"
  }
}

run "associacao_subnet_publica_com_route_table" {
  command = plan

  assert {
    condition     = aws_route_table_association.public.subnet_id == aws_subnet.public.id
    error_message = "Subnet pública deve estar associada à tabela de rotas pública"
  }

  assert {
    condition     = aws_route_table_association.public.route_table_id == aws_route_table.public.id
    error_message = "Associação deve referenciar a tabela de rotas pública correta"
  }
}
