# Skill: /projeto-pesquisa

## Descricao

Gera e gerencia toda a documentacao necessaria para submissao do projeto de pesquisa OncoNav na Plataforma Brasil (CEP/CONEP) e Rede Pesquisa EBSERH.

## Uso

```
/projeto-pesquisa                    # Gera checklist + todos os documentos
/projeto-pesquisa <documento>        # Gera documento especifico (ex: tcle, projeto, cronograma)
/projeto-pesquisa status             # Mostra status de cada documento
```

Documentos disponiveis: `projeto`, `tcle`, `concordancia`, `orcamento`, `cronograma`, `instrumentos`, `infraestrutura`, `compromisso-dados`, `responsabilidade`, `guia-pb`, `guia-ebserh`

## Contexto do Projeto de Pesquisa

- **Titulo**: "OncoNav: Plataforma Digital de Navegacao Oncologica com Inteligencia Artificial como Apoio a Decisao Clinica — Estudo Misto de Desenvolvimento e Validacao"
- **Tipo de estudo**: Misto (desenvolvimento tecnologico + coorte observacional prospectiva)
- **Instituicao**: Hospital Universitario Cassiano Antonio Moraes (HUCAM/UFES) — Rede EBSERH
- **Populacao**: Pacientes adultos (≥18 anos) com cancer de bexiga em acompanhamento no HUCAM
- **IA**: Ferramenta de apoio a decisao (profissional SEMPRE valida) — agente WhatsApp, priorizacao ML, alertas automaticos
- **Regulatorio**: Resolucao CNS 466/12, LGPD (Lei 13.709/18)
- **Populacoes vulneraveis**: Nao
- **PI**: Orientador/professor (pesquisador associado: desenvolvedor da plataforma)

## Diretorio de Documentos

Todos os documentos sao gerados em `docs/pesquisa/`:

| # | Arquivo | Descricao |
|---|---------|-----------|
| 1 | `README.md` | Checklist geral e status |
| 2 | `01-projeto-detalhado.md` | Projeto de pesquisa completo |
| 3 | `02-tcle.md` | Termo de Consentimento Livre e Esclarecido |
| 4 | `03-termo-concordancia.md` | Concordancia institucional HUCAM |
| 5 | `04-orcamento.md` | Orcamento detalhado |
| 6 | `05-cronograma.md` | Cronograma de execucao |
| 7 | `06-instrumentos-coleta.md` | Questionarios e instrumentos |
| 8 | `07-declaracao-infraestrutura.md` | Infraestrutura disponivel |
| 9 | `08-termo-compromisso-dados.md` | Compromisso de uso de dados |
| 10 | `09-termo-responsabilidade.md` | Responsabilidade do pesquisador |
| 11 | `10-guia-plataforma-brasil.md` | Guia de submissao Plataforma Brasil |
| 12 | `11-guia-rede-pesquisa-ebserh.md` | Guia Rede Pesquisa EBSERH |

## Pipeline de Geracao

### Quando executada sem argumento (`/projeto-pesquisa`)

1. Verificar se `docs/pesquisa/` existe, criar se nao
2. Gerar/atualizar cada documento seguindo os templates abaixo
3. Atualizar `README.md` com status de cada documento
4. Exibir resumo ao usuario

### Quando executada com argumento (`/projeto-pesquisa tcle`)

1. Gerar/atualizar apenas o documento solicitado
2. Atualizar status no `README.md`

### Quando executada com `status`

1. Listar todos os documentos com status (existente/pendente)
2. Verificar completude de cada documento (secoes obrigatorias presentes)

## Referencias do Projeto (consultar para enriquecer conteudo)

- `SPECS.md` — Especificacao tecnica completa do OncoNav
- `docs/desenvolvimento/plano-agentes-ia.md` — Arquitetura do agente IA
- `.cursor/rules/navegacao-oncologica.mdc` — Jornada do paciente oncologico
- `.cursor/rules/oncologista.mdc` — Terminologia e protocolos clinicos
- `ai-service/src/agent/clinical_rules.py` — 23 regras clinicas deterministicas
- `ai-service/src/agent/clinical_scores.py` — Scores MASCC e CISNE
- `ai-service/src/agent/priority_model.py` — Modelo LightGBM de priorizacao
- `backend/prisma/schema.prisma` — Modelo de dados completo

## Requisitos Regulatorios

### Resolucao CNS 466/12
- TCLE em linguagem acessivel (leiga)
- Riscos e beneficios explicitados
- Direito de retirada sem prejuizo
- Garantia de sigilo e confidencialidade
- Coleta de dados SOMENTE apos aprovacao do CEP

### LGPD (Lei 13.709/18)
- Dados anonimizados/pseudoanonimizados
- Base legal: consentimento explicito (Art. 7, I) + pesquisa (Art. 7, IV)
- Encarregado de dados identificado
- Plano de descarte apos conclusao

### Plataforma Brasil
- Todos documentos em PDF com copy/paste habilitado
- Folha de Rosto: imprimir, assinar, carimbar, escanear
- 6 etapas do formulario online
- Prazo CEP: ~30 dias | CONEP: ~60 dias (se aplicavel)

### Rede Pesquisa EBSERH
- Credenciamento via GOV.BR em sig.ebserh.gov.br/redepesquisa/
- Registro do projeto no sistema
- Envio para pesquisaclinica.hub@ebserh.gov.br
- Fluxo: Rede Pesquisa → CEP → parecer para EBSERH
