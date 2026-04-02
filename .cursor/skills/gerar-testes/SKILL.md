---
name: gerar-testes
description: Gera/atualiza testes unitários e E2E para arquivos modificados antes do commit
---

# Skill: /gerar-testes

## Descrição

Aciona o agente `test-generator` para analisar os arquivos modificados e gerar/atualizar testes unitários e E2E antes do commit.

## Uso

```
/gerar-testes [arquivos...]
```

Exemplos:

- `/gerar-testes` — analisa todos os arquivos modificados (`git diff`)
- `/gerar-testes backend/src/alerts/alerts.service.ts` — gera testes apenas para esse arquivo
- `/gerar-testes frontend/src/hooks/usePatients.ts frontend/src/components/patients/PatientList.tsx`

## O que faz

1. Identifica arquivos modificados (via `git diff` ou lista fornecida)
2. Para cada arquivo de produção modificado:
   - Localiza ou cria o arquivo de teste correspondente
   - Analisa o código para entender o comportamento esperado
   - Escreve testes cobrindo: happy path, erros, isolamento multi-tenant (backend), estado de loading/erro (frontend)
3. Executa os testes para verificar que passam
4. Reporta quais testes foram criados/atualizados e o resultado

## Atalho no fluxo de commit

Sempre executar **antes** de `/commit` ou de acionar o `github-organizer`:

```
/gerar-testes → seguranca-compliance (se backend) → github-organizer
```

## Cobertura mínima por camada

| Camada | Obrigatório |
|---|---|
| Backend service | Happy path + NotFoundException + isolamento multi-tenant |
| Backend service com escrita | Verificar `tenantId` no `where` das operações create/update/delete |
| Frontend hook | Sucesso + erro + loading |
| Frontend componente | Render + interação principal |
| AI Service (Python) | Happy path + fallback sem LLM + isolamento tenant_id |
| Regras clínicas (`clinical_rules.py`) | Caso positivo + caso negativo no limiar exato (ex: 38.0°C dispara, 37.9°C não) |
| Novo endpoint crítico | Teste E2E no Playwright |

## Fluxo para ai-service

Ao modificar arquivos Python no `ai-service/`:

```
/gerar-testes
    → (se clinical_rules.py / clinical_scores.py / symptom_analyzer.py)
      clinical-domain (validação clínica dos limiares)
    → seguranca-compliance (verificação de tenant_id e dados sensíveis)
    → github-organizer
```
