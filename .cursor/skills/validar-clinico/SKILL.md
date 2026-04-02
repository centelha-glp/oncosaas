---
name: validar-clinico
description: Aciona o agente clinical-domain para validar lógica clínica oncológica, regras, limiares e protocolos
---

# Skill: /validar-clinico

## Descrição

Aciona o agente `clinical-domain` para validação obrigatória de lógica clínica oncológica antes de qualquer commit que toque regras de triagem, scores ou protocolos.

## Uso

```
/validar-clinico [arquivo ou contexto]
```

### Exemplos

- `/validar-clinico` — valida todos os arquivos clínicos modificados
- `/validar-clinico ai-service/src/agent/clinical_rules.py` — valida regras específicas
- `/validar-clinico R24_nova_regra` — valida uma nova regra adicionada
- `/validar-clinico limiar de temperatura R01` — verifica se o limiar está correto
- `/validar-clinico backend/src/clinical-protocols/templates/bladder.protocol.ts`

## O que faz

1. Lê os arquivos clínicos modificados
2. Verifica limiares numéricos contra protocolos de referência (MASCC, CISNE, AC Camargo, ICESP)
3. Confirma que nenhum cenário ER_IMMEDIATE foi rebaixado ou removido
4. Valida a lógica de nadir (D+7–D+14) e janela de risco (D+0–D+21)
5. Verifica consistência entre `clinical_rules.py` e `system_prompt.py` (limiares devem ser iguais)
6. Garante que mensagens ao paciente usam linguagem acessível
7. Aprova ou rejeita com justificativa clínica

## Arquivos que OBRIGATORIAMENTE requerem /validar-clinico

- `ai-service/src/agent/clinical_rules.py`
- `ai-service/src/agent/clinical_scores.py`
- `ai-service/src/agent/symptom_analyzer.py`
- `backend/src/clinical-protocols/templates/*.protocol.ts`
- Qualquer enum de `ClinicalDisposition`

## Fluxo obrigatório

```
código clínico alterado
    → /validar-clinico
    → /gerar-testes (caso positivo + negativo no limiar exato)
    → seguranca-compliance
    → github-organizer
```

## Referências

- Rules: `.cursor/rules/clinical-domain.mdc`
- Regras hard: `ai-service/src/agent/clinical_rules.py`
- Scores: `ai-service/src/agent/clinical_scores.py`
- Protocolos: `backend/src/clinical-protocols/templates/`
