---
name: tarefa-crewai-design
description: Desenha Crew e Agent no CrewAI com roles, goals, processos sequenciais ou hierárquicos e allow_delegation. Use quando o pedido citar Crew, Agent, hierarchical process ou crew de agentes.
disable-model-invocation: true
---

# CrewAI — desenho de crew e processos

## Objectivo

Definir equipas de agentes com responsabilidades claras e processo explícito antes de detalhar tasks.

## Quando usar

- CR1: primeira modelagem ou refactor da estrutura da crew.

## Passos

1. Ler https://docs.crewai.com/ para API actual (nomes de classes e parâmetros).
2. Listar agentes com `role`, `goal` e `backstory` concisos; evitar sobreposição de competências.
3. Escolher `process` (sequencial, hierárquico, etc.) conforme doc e necessidade de delegação.
4. Configurar `allow_delegation` e verbosidade coerentes com custo e latência.
5. Alinhar outputs esperados ao contrato downstream (JSON, texto estruturado).
6. Rever segurança: agentes não devem executar código arbitrário do utilizador.
7. Documentar variáveis de ambiente e chaves necessárias.

## Links oficiais

- https://docs.crewai.com/

## Anti-padrões

- Demasiados agentes com metas vagas que duplicam raciocínio.
- Delegação circular sem limite de profundidade.
- Ignorar limites de API dos LLMs subjacentes.

## Ligação ONCONAV

Conteúdo médico sensível segue políticas LGPD; crews não substituem validação clínica nem guards do backend.
