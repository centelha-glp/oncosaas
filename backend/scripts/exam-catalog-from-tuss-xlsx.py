#!/usr/bin/env python3
"""
Converte a planilha oficial ANS "Correlação TUSS x Rol" (.xlsx) em JSON para
POST /api/v1/exam-catalog/import (ImportExamCatalogDto).

Uso:
  python3 scripts/exam-catalog-from-tuss-xlsx.py \\
    --input data/ans/CorrelacaoTUSS.202409Rol.2021_TUSS202503_RN627L.2025.xlsx \\
    --output data/ans/exam-catalog-import.json

Requisitos: apenas biblioteca padrão (parseia o XML interno do .xlsx).

Fonte: https://www.gov.br/ans/pt-br/acesso-a-informacao/participacao-da-sociedade/atualizacao-do-rol-de-procedimentos
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from typing import Any

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

# Grupos (coluna N) incluídos no catálogo de exames complementares (laboratório, imagem, AP/imuno).
# Excluídos de propósito: endoscopia invasiva, radioterapia, cirurgia, etc.
ALLOWED_GROUPS = {
    "PROCEDIMENTOS LABORATORIAIS",
    "MÉTODOS DIAGNÓSTICOS POR IMAGEM",
    "GENÉTICA",
    "EXAMES ESPECÍFICOS",
    "MEDICINA NUCLEAR",
    "MEDICINA TRANSFUSIONAL",
    "ANATOMIA PATOLÓGICA E CITOPATOLOGIA",
    "ELETROFISIOLÓGICOS / MECÂNICOS E FUNCIONAIS",
}

# Desempate quando o mesmo código TUSS aparece em mais de um grupo/tipo.
TYPE_PRIORITY: dict[str, int] = {
    "IMMUNOHISTOCHEMICAL": 4,
    "ANATOMOPATHOLOGICAL": 3,
    "IMAGING": 2,
    "LABORATORY": 1,
}


def load_shared_strings(z: zipfile.ZipFile) -> list[str]:
    raw = z.read("xl/sharedStrings.xml")
    root = ET.fromstring(raw)
    out: list[str] = []
    for si in root.findall(f".//{NS}si"):
        parts: list[str] = []
        for t in si.findall(f".//{NS}t"):
            parts.append(t.text or "")
        out.append("".join(parts))
    return out


def parse_cell(cell: ET.Element, strings: list[str]) -> str | None:
    t = cell.get("t")
    v_el = cell.find(f"{NS}v")
    if v_el is None or v_el.text is None:
        return None
    if t == "s":
        return strings[int(v_el.text)]
    return v_el.text


def parse_sheet_rows(path: str) -> list[dict[str, str | None]]:
    z = zipfile.ZipFile(path)
    strings = load_shared_strings(z)
    root = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    rows_out: list[dict[str, str | None]] = []
    for row in root.findall(f".//{NS}row"):
        r = int(row.get("r", "0"))
        if r < 9:
            continue
        cells: dict[str, str | None] = {}
        for c in row.findall(f"{NS}c"):
            ref = c.get("r") or ""
            m = re.match(r"^([A-Z]+)", ref)
            if not m:
                continue
            col = m.group(1)
            cells[col] = parse_cell(c, strings)
        rows_out.append(cells)
    return rows_out


def classify_type(group_n: str | None, terminology_b: str | None) -> str | None:
    if not group_n or group_n not in ALLOWED_GROUPS:
        return None
    b = (terminology_b or "").upper()
    if group_n == "PROCEDIMENTOS LABORATORIAIS":
        return "LABORATORY"
    if group_n == "MÉTODOS DIAGNÓSTICOS POR IMAGEM":
        return "IMAGING"
    if group_n == "MEDICINA NUCLEAR":
        return "IMAGING"
    if group_n == "GENÉTICA":
        return "LABORATORY"
    if group_n == "MEDICINA TRANSFUSIONAL":
        return "LABORATORY"
    if group_n == "EXAMES ESPECÍFICOS":
        return "LABORATORY"
    if group_n == "ELETROFISIOLÓGICOS / MECÂNICOS E FUNCIONAIS":
        return "LABORATORY"
    if group_n == "ANATOMIA PATOLÓGICA E CITOPATOLOGIA":
        immuno_keys = (
            "IMUNOISTOQUÍMICA",
            "IMUNOFLUORESCÊNCIA",
            "IMUNOFENOTIPAGEM",
            "PD-L1",
            "HIBRIDIZAÇÃO",
            "IMUNOISTO",
        )
        if any(k in b for k in immuno_keys):
            return "IMMUNOHISTOCHEMICAL"
        return "ANATOMOPATHOLOGICAL"
    return None


def source_version_from_filename(path: str) -> str:
    base = path.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    if base.lower().endswith(".xlsx"):
        base = base[:-5]
    return base


def build_items(rows: list[dict[str, str | None]]) -> list[dict[str, Any]]:
    """Agrupa por código TUSS; mantém o tipo de maior prioridade e um nome representativo."""
    by_code: dict[str, list[tuple[int, str, str, str | None, str | None]]] = defaultdict(list)
    for cells in rows:
        code_raw = cells.get("A")
        if not code_raw:
            continue
        code = str(code_raw).strip()
        b = cells.get("B")
        d = cells.get("D")
        n = cells.get("N")
        if not b or not b.strip():
            continue
        if d in (None, "", "---"):
            continue
        if n in (None, "", "---"):
            continue
        t = classify_type(n, b)
        if not t:
            continue
        pri = TYPE_PRIORITY[t]
        rol_name = str(d).strip()
        by_code[code].append((pri, t, b.strip(), rol_name if rol_name != "---" else None, n))

    items: list[dict[str, Any]] = []
    for code, variants in sorted(by_code.items(), key=lambda x: x[0]):
        best = max(variants, key=lambda v: (v[0], len(v[2])))
        _pri, typ, name, rol_item, _n = best
        item: dict[str, Any] = {
            "code": code,
            "name": name,
            "type": typ,
        }
        if rol_item:
            item["rolItemCode"] = rol_item[:512]
        items.append(item)
    return items


def main() -> int:
    ap = argparse.ArgumentParser(description="Gera JSON para import do catálogo a partir do xlsx TUSS/Rol ANS.")
    ap.add_argument(
        "--input",
        "-i",
        default="data/ans/CorrelacaoTUSS.202409Rol.2021_TUSS202503_RN627L.2025.xlsx",
        help="Caminho do .xlsx oficial",
    )
    ap.add_argument("--output", "-o", default="", help="Arquivo JSON de saída (stdout se vazio)")
    ap.add_argument("--indent", type=int, default=0, help="Indentação JSON (0 = compacto)")
    args = ap.parse_args()

    rows = parse_sheet_rows(args.input)
    items = build_items(rows)
    payload = {
        "sourceVersion": source_version_from_filename(args.input),
        "items": items,
    }
    indent = args.indent if args.indent > 0 else None
    text = json.dumps(payload, ensure_ascii=False, indent=indent)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"OK: {len(items)} itens -> {args.output}", file=sys.stderr)
    else:
        print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
