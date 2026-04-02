---
name: prompt
description: Aciona o agente llm-context-engineer para otimizar prompts, context_builder, janela de contexto e prompt caching do agente oncológico
---

# Skill: /prompt

## Descrição

Aciona o agente `llm-context-engineer` para engenharia de contexto LLM: otimizar prompts do orquestrador e subagentes, reduzir tokens mantendo qualidade clínica, e melhorar coerência das respostas.

## Uso

```
/prompt [tarefa ou contexto]
```

### Exemplos

- `/prompt reduzir tokens do context_builder sem perder dados clínicos` — otimização de janela
- `/prompt adicionar instrução de coerência de tópico no orchestrator` — editar system prompt
- `/prompt atualizar regras de detecção de sintomas para febre` — consistência com clinical_rules
- `/prompt otimizar para prompt caching` — reorganizar seções estáticas/dinâmicas
- `/prompt` — audita os prompts existentes e sugere melhorias

## O que faz

1. Lê prompts em `ai-service/src/agent/prompts/`
2. Analisa `context_builder.py` para otimização de montagem de contexto
3. Verifica consistência entre limiares do prompt e `clinical_rules.py`
4. Reorganiza seções para maximizar cache hit (estático antes de dinâmico)
5. Propõe reduções de token sem remover dados clínicos críticos

## Regras críticas

- Partes estáticas do system prompt SEMPRE antes do bloco `## CONTEXTO CLÍNICO`
- Nunca remover `## COERÊNCIA DE TÓPICO` — contém aprendizados de falhas reais
- Nunca divergir limiares entre prompts e `clinical_rules.py`
- Nunca usar inglês em textos que o paciente vê
- Não tocar `symptom_topic_active` — lógica crítica de coerência

## Estrutura de prompts

| Arquivo | Responsabilidade |
|---------|-----------------|
| `orchestrator_prompt.py` | System prompt do Opus + ferramentas de roteamento |
| `system_prompt.py` | System prompt base + regras de detecção de sintomas |
| `action_tools.py` | Tools de ação dos subagentes |
| `symptom_prompts.py` | Prompts de análise de sintomas |
| `questionnaire_prompts.py` | Prompts ESAS/PRO-CTCAE |

## Referências

- Rules: `.claude/rules/llm-context-engineer.md`
- Prompts: `ai-service/src/agent/prompts/`
- Context builder: `ai-service/src/agent/context_builder.py`
