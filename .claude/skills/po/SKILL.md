---
name: po
description: Aciona o agente product-owner para gestão de backlog, milestones e issues no GitHub
---

# Skill: /po

## Descrição

Aciona o agente `product-owner` para gestão do backlog e estruturação do desenvolvimento no GitHub.

## Uso

```
/po [contexto ou pedido]
```

### Exemplos

- `/po` — análise o estado atual do GitHub e sugira o que falta estruturar
- `/po criar issues para o milestone MVP - Navegação` — mapeia e cria as issues faltantes
- `/po quebrar a issue #21 em subtarefas` — detalha uma issue existente em tarefas menores
- `/po organizar backlog` — revisa todas as issues abertas e sugere priorização e milestones
- `/po novo milestone: <nome>` — propõe estrutura de milestone com issues
- `/po refinamento: <descrição do épico>` — quebra um épico em issues acionáveis

## O que faz

1. Consulta o estado atual do GitHub (milestones, issues, labels)
2. Lê o código relevante para entender o que já foi implementado
3. Propõe estrutura de milestones e issues alinhada com o MVP de bexiga
4. Cria/atualiza issues no GitHub com body completo, critérios de aceite e tarefas técnicas
5. Aplica labels e vincula ao milestone correto

## Fluxo típico

```
/po → consulta GitHub → lê código → propõe estrutura → confirma com você → cria issues
```

O agente sempre confirma a estrutura proposta antes de criar issues no GitHub.
