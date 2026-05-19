"""
Harness de regressão para assistentes clínicos (estruturação v3, exam-extract).

Uso:
  python -m eval
  python -m eval --report eval/out/report.json

Eval ao vivo (opcional, requer chaves LLM):
  RUN_LLM_EVAL=1 python -m pytest tests/eval/test_clinical_eval_live.py -q
"""

from __future__ import annotations

import argparse
import json
import logging
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Optional

from src.agent.llm_provider import llm_provider
from src.routes.clinical_evolution_structure import (
    EXTRACTION_SCHEMA_VERSION,
    _build_response_from_parsed,
    _degraded_structure_response,
    _parse_structure_json,
)

logger = logging.getLogger(__name__)

EVAL_ROOT = Path(__file__).resolve().parent
FIXTURES_ROOT = EVAL_ROOT / "fixtures" / "clinical_eval"
DEFAULT_REPORT_DIR = EVAL_ROOT / "out"


@dataclass
class CaseResult:
    suite: str
    case_id: str
    passed: bool
    parse_ok: Optional[bool] = None
    errors: list[str] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)


@dataclass
class ClinicalEvalReport:
    total: int = 0
    passed: int = 0
    failed: int = 0
    parse_ok_count: int = 0
    parse_ok_rate: float = 0.0
    cases: list[CaseResult] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "total": self.total,
            "passed": self.passed,
            "failed": self.failed,
            "parse_ok_count": self.parse_ok_count,
            "parse_ok_rate": round(self.parse_ok_rate, 4),
            "cases": [asdict(c) for c in self.cases],
        }


def _read_llm_output(case_dir: Path) -> str:
    for name in ("llm_output.json", "llm_output.txt"):
        path = case_dir / name
        if not path.is_file():
            continue
        raw = path.read_text(encoding="utf-8").strip()
        if name.endswith(".json"):
            try:
                obj = json.loads(raw)
            except json.JSONDecodeError:
                return raw
            if isinstance(obj, dict):
                return json.dumps(obj, ensure_ascii=False)
            if isinstance(obj, str):
                return obj
            return raw
        return raw
    raise FileNotFoundError(f"Sem llm_output.json/txt em {case_dir}")


def _load_golden(case_dir: Path) -> dict[str, Any]:
    path = case_dir / "golden.json"
    if not path.is_file():
        raise FileNotFoundError(f"Sem golden.json em {case_dir}")
    return json.loads(path.read_text(encoding="utf-8"))


def _discover_cases(suite_dir: Path) -> list[Path]:
    if not suite_dir.is_dir():
        return []
    return sorted(
        p for p in suite_dir.iterdir() if p.is_dir() and (p / "golden.json").is_file()
    )


def _norm_list(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []
    return [str(v).strip() for v in values if v is not None and str(v).strip()]


def _check_expect(
    expect: dict[str, Any],
    actual: dict[str, Any],
    errors: list[str],
    *,
    prefix: str = "",
) -> None:
    for key, expected in expect.items():
        path = f"{prefix}{key}" if prefix else key
        if key == "markdown_contains":
            md = str(actual.get("markdownSummary") or "")
            for needle in _norm_list(expected):
                if needle.lower() not in md.lower():
                    errors.append(f"{path}: falta substring {needle!r} no markdown")
            continue
        if key == "clinical_exam_display_names":
            names = [
                str(x.get("display_name", "")).strip()
                for x in actual.get("clinical_exam_requests") or []
                if isinstance(x, dict)
            ]
            exp = _norm_list(expected)
            if names != exp:
                errors.append(f"{path}: esperado {exp!r}, obteve {names!r}")
            continue
        if key == "clinical_exam_display_names_contains":
            names = [
                str(x.get("display_name", "")).strip().lower()
                for x in actual.get("clinical_exam_requests") or []
                if isinstance(x, dict)
            ]
            for needle in _norm_list(expected):
                if needle.lower() not in names:
                    errors.append(
                        f"{path}: display_name {needle!r} ausente em {names!r}"
                    )
            continue
        if key == "clinical_exam_requests_min":
            count = len(actual.get("clinical_exam_requests") or [])
            if count < int(expected):
                errors.append(
                    f"{path}: esperado >= {expected} pedidos, obteve {count}"
                )
            continue
        if key == "prescription_indication_prefix":
            lines = actual.get("clinical_prescription_lines") or []
            prefix = str(expected)
            if not lines:
                errors.append(f"{path}: sem linhas de prescrição")
                continue
            first = lines[0] if isinstance(lines[0], dict) else {}
            ind = str(first.get("indication") or "")
            if not ind.startswith(prefix):
                errors.append(
                    f"{path}: indication deve começar com {prefix!r}, obteve {ind!r}"
                )
            continue
        if key == "prescription_medication_names":
            names = [
                str(x.get("medication_name", "")).strip().lower()
                for x in actual.get("clinical_prescription_lines") or []
                if isinstance(x, dict)
            ]
            for needle in _norm_list(expected):
                if needle.lower() not in names:
                    errors.append(
                        f"{path}: medicamento {needle!r} ausente em {names!r}"
                    )
            continue
        if key == "medication_names":
            names = [
                str(x.get("name", "")).strip()
                for x in actual.get("medications") or []
                if isinstance(x, dict)
            ]
            exp_lower = [e.lower() for e in _norm_list(expected)]
            got_lower = [n.lower() for n in names]
            for e in exp_lower:
                if e not in got_lower:
                    errors.append(f"{path}: medicamento {e!r} ausente em {names!r}")
            continue
        if key == "complementary_exam_names":
            names = [
                str(x.get("name", "")).strip()
                for x in actual.get("complementaryExams") or actual.get("complementary_exams") or []
                if isinstance(x, dict)
            ]
            exp = _norm_list(expected)
            if names != exp:
                errors.append(f"{path}: esperado {exp!r}, obteve {names!r}")
            continue
        if key == "detected_categories":
            got = _norm_list(actual.get("detectedCategories") or actual.get("detected_categories"))
            exp = _norm_list(expected)
            if got != exp:
                errors.append(f"{path}: esperado {exp!r}, obteve {got!r}")
            continue
        if key == "patient_patch_occupation":
            patch = actual.get("patient_patch") or {}
            got = patch.get("occupation") if isinstance(patch, dict) else None
            if got != expected:
                errors.append(f"{path}: esperado {expected!r}, obteve {got!r}")
            continue
        if key == "rejection_count_min":
            count = len(actual.get("rejection_report") or [])
            if count < int(expected):
                errors.append(
                    f"{path}: esperado >= {expected} rejeições, obteve {count}"
                )
            continue
        if key == "skipped_count":
            got = int(actual.get("skippedCount") or actual.get("skipped_count") or 0)
            if got != int(expected):
                errors.append(f"{path}: esperado skipped={expected!r}, obteve {got!r}")
            continue

        got = actual.get(key)
        if got != expected:
            errors.append(f"{path}: esperado {expected!r}, obteve {got!r}")


def evaluate_structure_case(case_dir: Path) -> CaseResult:
    case_id = case_dir.name
    errors: list[str] = []
    golden = _load_golden(case_dir)
    expect = golden.get("expect") or {}

    try:
        raw = _read_llm_output(case_dir)
    except FileNotFoundError as e:
        return CaseResult(
            suite="structure_v3",
            case_id=case_id,
            passed=False,
            errors=[str(e)],
        )

    parsed = _parse_structure_json(raw)
    if parsed:
        resp = _build_response_from_parsed(parsed)
        actual = resp.model_dump()
        parse_ok = True
    else:
        resp = _degraded_structure_response(
            reason="Resposta não foi JSON estruturado válido.",
            llm_available=True,
            parse_ok=False,
        )
        actual = resp.model_dump()
        parse_ok = False

    if actual.get("extraction_schema_version") != EXTRACTION_SCHEMA_VERSION:
        errors.append(
            f"schema: esperado {EXTRACTION_SCHEMA_VERSION!r}, "
            f"obteve {actual.get('extraction_schema_version')!r}"
        )

    _check_expect(expect, actual, errors)

    return CaseResult(
        suite="structure_v3",
        case_id=case_id,
        passed=len(errors) == 0,
        parse_ok=parse_ok,
        errors=errors,
        metrics={
            "clinical_exam_count": len(actual.get("clinical_exam_requests") or []),
            "medication_count": len(actual.get("medications") or []),
            "rejection_count": len(actual.get("rejection_report") or []),
        },
    )


def evaluate_exam_case(case_dir: Path) -> CaseResult:
    case_id = case_dir.name
    errors: list[str] = []
    golden = _load_golden(case_dir)
    expect = golden.get("expect") or {}

    try:
        raw = _read_llm_output(case_dir)
    except FileNotFoundError as e:
        return CaseResult(
            suite="exam_extract",
            case_id=case_id,
            passed=False,
            errors=[str(e)],
        )

    parsed = llm_provider._parse_exam_extract_json(raw)
    parse_ok = parsed is not None
    if parsed:
        actual = dict(parsed)
        actual["markdownFromStructuredParse"] = True
        raw_ce = actual.get("complementaryExams") or actual.get("complementary_exams")
        if isinstance(raw_ce, list) and raw_ce:
            from src.routes.exam_extract import ExamExtractComplementaryItem

            validated: list[dict[str, Any]] = []
            skipped = int(parsed.get("parserSkippedCount") or 0)
            for item in raw_ce:
                try:
                    validated.append(
                        ExamExtractComplementaryItem.model_validate(item).model_dump()
                    )
                except Exception:
                    skipped += 1
            actual["complementaryExams"] = validated
            actual["skippedCount"] = skipped
    else:
        actual = {
            "markdownSummary": "",
            "detectedCategories": [],
            "disclaimer": "",
            "parse_ok": False,
        }

    _check_expect(expect, {**actual, "parse_ok": parse_ok}, errors)

    return CaseResult(
        suite="exam_extract",
        case_id=case_id,
        passed=len(errors) == 0,
        parse_ok=parse_ok,
        errors=errors,
        metrics={
            "markdown_len": len(str(actual.get("markdownSummary") or "")),
            "category_count": len(actual.get("detectedCategories") or []),
            "complementary_count": len(actual.get("complementaryExams") or []),
        },
    )


def evaluate_suggest_orders_case(case_dir: Path) -> CaseResult:
    """Valida saída 2A/2B (llm_output.json) contra golden — regressão offline."""
    case_id = case_dir.name
    errors: list[str] = []
    golden = _load_golden(case_dir)
    expect = golden.get("expect") or {}

    try:
        raw = _read_llm_output(case_dir)
    except FileNotFoundError as e:
        return CaseResult(
            suite="suggest_orders",
            case_id=case_id,
            passed=False,
            errors=[str(e)],
        )

    if isinstance(raw, dict):
        actual = raw
        parse_ok = True
    else:
        parsed = _parse_structure_json(raw)
        actual = parsed or {}
        parse_ok = parsed is not None

    _check_expect(expect, actual, errors)

    return CaseResult(
        suite="suggest_orders",
        case_id=case_id,
        passed=len(errors) == 0,
        parse_ok=parse_ok,
        errors=errors,
        metrics={
            "clinical_exam_count": len(actual.get("clinical_exam_requests") or []),
            "prescription_count": len(actual.get("clinical_prescription_lines") or []),
        },
    )


def run_clinical_eval(fixtures_root: Path | None = None) -> ClinicalEvalReport:
    root = fixtures_root or FIXTURES_ROOT
    report = ClinicalEvalReport()

    suites = [
        ("structure_v3", evaluate_structure_case),
        ("exam_extract", evaluate_exam_case),
        ("suggest_orders", evaluate_suggest_orders_case),
    ]

    for suite_name, evaluator in suites:
        for case_dir in _discover_cases(root / suite_name):
            result = evaluator(case_dir)
            report.cases.append(result)
            report.total += 1
            if result.passed:
                report.passed += 1
            else:
                report.failed += 1
            if result.parse_ok:
                report.parse_ok_count += 1

    if report.total:
        report.parse_ok_rate = report.parse_ok_count / report.total
    return report


def _print_report(report: ClinicalEvalReport) -> None:
    print(
        f"Clinical eval: {report.passed}/{report.total} passed "
        f"(parse_ok {report.parse_ok_count}/{report.total}, "
        f"rate={report.parse_ok_rate:.0%})"
    )
    for case in report.cases:
        status = "OK" if case.passed else "FAIL"
        line = f"  [{status}] {case.suite}/{case.case_id}"
        if case.parse_ok is not None:
            line += f" parse_ok={case.parse_ok}"
        print(line)
        for err in case.errors:
            print(f"       - {err}")


def main() -> int:
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(description="Harness de eval clínico ONCONAV")
    parser.add_argument(
        "--fixtures",
        type=Path,
        default=FIXTURES_ROOT,
        help="Raiz das fixtures clinical_eval",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=None,
        help="Caminho JSON de saída (default: eval/out/report-<timestamp>.json)",
    )
    args = parser.parse_args()

    report = run_clinical_eval(args.fixtures)
    _print_report(report)

    out_path = args.report
    if out_path is None:
        DEFAULT_REPORT_DIR.mkdir(parents=True, exist_ok=True)
        out_path = DEFAULT_REPORT_DIR / "report.json"

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(report.to_dict(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Relatório JSON: {out_path}")

    return 0 if report.failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
