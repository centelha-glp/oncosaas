---
name: squad-produto
description: Squad Produto — visão estratégica, arquitetura e documentação do ONCONAV
---

# Squad Produto

Equipe responsável por decisões de produto, arquitetura cross-layer e documentação técnica do ONCONAV.

## Teammates

### product-owner
Papel: gestão de backlog, milestones e issues no GitHub.
Responsabilidades:
- Estruturar épicos em issues acionáveis
- Criar e organizar milestones no GitHub
- Priorizar backlog conforme valor clínico e viabilidade técnica
- Mapear dependências entre features

### architect
Papel: consistência arquitetural e decisões cross-layer.
Responsabilidades:
- Validar contratos entre camadas (DTOs ↔ Zod ↔ Pydantic)
- Identificar violações de arquitetura (frontend chamando ai-service diretamente, lógica clínica em controllers)
- Revisar ADRs (Architecture Decision Records)
- Garantir isolamento multi-tenant em todas as camadas

### documentation
Papel: documentação técnica, OpenAPI e docs CEP/EBSERH.
Responsabilidades:
- Manter decoradores `@nestjs/swagger` nos controllers
- Gerar guias de integração FHIR
- Atualizar documentos de pesquisa em `docs/pesquisa/`
- Manter CHANGELOG.md e READMEs

## Coordenação

1. **architect** define o contrato e valida a viabilidade técnica
2. **product-owner** cria as issues e organiza o backlog
3. **documentation** registra decisões e atualiza a documentação

## Quando acionar este squad

- Planejar nova feature ou épico
- Revisar arquitetura de um módulo
- Estruturar backlog para uma sprint
- Atualizar documentos CEP/EBSERH
- Criar ADR para decisão arquitetural significativa
