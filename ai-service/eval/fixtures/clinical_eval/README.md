# Fixtures de eval clínico (sintéticas)

**Não commitar laudos, evoluções ou dados reais de pacientes.** Use apenas textos inventados ou redigidos.

## Layout

```
structure_v3/<caso>/
  llm_output.json   # JSON que o modelo devolveria (string ou objeto)
  golden.json       # expectativas de parse/validação

exam_extract/<caso>/
  llm_output.json
  golden.json
```

## Adicionar um caso

1. Crie uma pasta com nome descritivo (ex.: `structure_v3/03_prescription_lines/`).
2. Coloque o JSON bruto do modelo em `llm_output.json` (pode ser objeto ou string).
3. Defina `golden.json` com o bloco `expect` (ver exemplos nas pastas existentes).
4. Rode `python -m pytest tests/eval/ -q` ou `python -m eval.harness`.

## Campos úteis em `golden.json`

| Campo | Uso |
|-------|-----|
| `expect.parse_ok` | Estruturação: JSON válido após parse |
| `expect.degraded` | Resposta degradada |
| `expect.clinical_exam_requests` | Lista exata de `display_name` esperados |
| `expect.medication_names` | Nomes de medicamentos (case-insensitive) |
| `expect.markdown_contains` | Substrings obrigatórias no markdown (exam) |
| `expect.detected_categories` | Categorias LAB/IMAGING/… |
| `expect.extraction_source` | `llm` ou `mock` (contrato HTTP) |
| `expect.rejection_count_min` | Mínimo de itens em `rejection_report` (estruturação) |
| `expect.skipped_count` | Itens `complementaryExams` inválidos omitidos (exam) |

## Casos incluídos

- **structure_v3:** follow-up, JSON inválido, domínios estendidos, laboratório, navegação, ECOG + exame
- **exam_extract:** painel lab, markdown only, skipped complementar, imagem, categorias mistas, texto plano lab
- **suggest_orders:** expansão perfil lipídico, contextual metformina/renal, anti-duplicação creatinina, suspend conduta, revisão de terapia, sem fármaco fantasma
