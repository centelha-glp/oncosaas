import threading
import time
import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

"""
Agent Observability Tracer.
Collects pipeline execution traces in a ring buffer for debugging and monitoring.
"""

MAX_TRACES = 500


class PipelineSpan:
    """Represents a single timed step within an agent trace."""

    def __init__(self, name: str):
        self.name = name
        self._start = time.monotonic()
        self.duration_ms: Optional[float] = None
        self.data: Dict[str, Any] = {}

    def finish(self, **data: Any) -> "PipelineSpan":
        self.duration_ms = round((time.monotonic() - self._start) * 1000, 1)
        self.data = data
        return self

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "duration_ms": self.duration_ms,
            "data": self.data,
        }


class AgentTrace:
    """Captures the full execution of one agent request."""

    def __init__(self, patient_id: str, tenant_id: str):
        self.trace_id = str(uuid.uuid4())[:8]
        self.patient_id = patient_id
        self.tenant_id = tenant_id
        self.timestamp = datetime.now(timezone.utc).isoformat()
        self._start = time.monotonic()

        self.spans: List[PipelineSpan] = []
        self.llm_calls: List[Dict[str, Any]] = []

        # Pipeline metadata
        self.pipeline_path: str = "main"  # main | questionnaire | emergency | greeting
        self.intent: Optional[str] = None
        self.intent_confidence: Optional[float] = None
        self.symptoms_detected: int = 0
        self.overall_severity: Optional[str] = None
        self.clinical_disposition: Optional[str] = None
        self.clinical_rules_fired: List[str] = []
        self.actions_generated: List[str] = []
        self.subagents_called: List[str] = []

        self.total_duration_ms: Optional[float] = None
        self.error: Optional[str] = None

    def finish(self, error: Optional[str] = None) -> None:
        self.total_duration_ms = round((time.monotonic() - self._start) * 1000, 1)
        self.error = error

    def to_dict(self) -> Dict[str, Any]:
        return {
            "trace_id": self.trace_id,
            "patient_id": self.patient_id,
            "tenant_id": self.tenant_id,
            "timestamp": self.timestamp,
            "total_duration_ms": self.total_duration_ms,
            "pipeline_path": self.pipeline_path,
            "intent": self.intent,
            "intent_confidence": self.intent_confidence,
            "symptoms_detected": self.symptoms_detected,
            "overall_severity": self.overall_severity,
            "clinical_disposition": self.clinical_disposition,
            "clinical_rules_fired": self.clinical_rules_fired,
            "actions_generated": self.actions_generated,
            "subagents_called": self.subagents_called,
            "llm_calls": self.llm_calls,
            "spans": [s.to_dict() for s in self.spans],
            "error": self.error,
        }


class AgentTracer:
    """
    Thread-safe ring buffer of AgentTrace objects.
    Provides aggregate stats for observability dashboards.
    """

    def __init__(self, maxlen: int = MAX_TRACES):
        self._traces: deque = deque(maxlen=maxlen)
        self._lock = threading.Lock()

    def start_trace(self, patient_id: str, tenant_id: str) -> AgentTrace:
        return AgentTrace(patient_id, tenant_id)

    def finish_trace(self, trace: AgentTrace, error: Optional[str] = None) -> None:
        trace.finish(error=error)
        with self._lock:
            self._traces.append(trace.to_dict())

    def start_span(self, trace: AgentTrace, name: str) -> PipelineSpan:
        span = PipelineSpan(name)
        trace.spans.append(span)
        return span

    def record_llm_call(
        self,
        trace: AgentTrace,
        step: str,
        provider: str,
        model: str,
        duration_ms: float,
        error: Optional[str] = None,
    ) -> None:
        trace.llm_calls.append(
            {
                "step": step,
                "provider": provider,
                "model": model,
                "duration_ms": round(duration_ms, 1),
                "error": error,
            }
        )

    def clear_by_tenant(self, tenant_id: str) -> int:
        """Remove only the traces that belong to *tenant_id*.

        Returns the number of entries removed.  The global ring buffer is
        rebuilt in-place so traces from other tenants are never affected.
        """
        with self._lock:
            before = len(self._traces)
            kept = [t for t in self._traces if t.get("tenant_id") != tenant_id]
            self._traces.clear()
            self._traces.extend(kept)
            return before - len(self._traces)

    def get_traces(self, limit: int = 50, tenant_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with self._lock:
            traces = list(self._traces)
        if tenant_id is not None:
            traces = [t for t in traces if t.get("tenant_id") == tenant_id]
        return list(reversed(traces))[:limit]

    def get_stats(self, tenant_id: Optional[str] = None) -> Dict[str, Any]:
        with self._lock:
            traces = list(self._traces)
        if tenant_id is not None:
            traces = [t for t in traces if t.get("tenant_id") == tenant_id]

        if not traces:
            return {
                "total_traces": 0,
                "error_rate_pct": 0.0,
                "avg_duration_ms": 0.0,
                "p95_duration_ms": 0.0,
                "llm_usage_rate_pct": 0.0,
                "intent_distribution": {},
                "disposition_distribution": {},
                "severity_distribution": {},
                "pipeline_path_distribution": {},
                "avg_span_durations_ms": {},
                "avg_llm_duration_ms": 0.0,
                "subagent_usage": {},
            }

        total = len(traces)
        errors = sum(1 for t in traces if t.get("error"))
        durations = [t["total_duration_ms"] for t in traces if t.get("total_duration_ms")]
        llm_traces = [t for t in traces if t.get("llm_calls")]

        def _dist(key: str) -> Dict[str, int]:
            counts: Dict[str, int] = {}
            for t in traces:
                v = t.get(key) or "unknown"
                counts[v] = counts.get(v, 0) + 1
            return counts

        # Avg span durations
        span_buckets: Dict[str, List[float]] = {}
        for t in traces:
            for span in t.get("spans", []):
                if span.get("duration_ms") is not None:
                    span_buckets.setdefault(span["name"], []).append(span["duration_ms"])
        avg_spans = {k: round(sum(v) / len(v), 1) for k, v in span_buckets.items()}

        # Avg LLM call duration
        all_llm_durations = [
            lc["duration_ms"]
            for t in traces
            for lc in t.get("llm_calls", [])
            if lc.get("duration_ms")
        ]

        # Subagent usage
        subagent_counts: Dict[str, int] = {}
        for t in traces:
            for sa in t.get("subagents_called", []):
                subagent_counts[sa] = subagent_counts.get(sa, 0) + 1

        # p95 total duration
        sorted_dur = sorted(durations)
        p95_idx = max(0, int(len(sorted_dur) * 0.95) - 1)
        p95 = sorted_dur[p95_idx] if sorted_dur else 0.0

        return {
            "total_traces": total,
            "error_rate_pct": round(errors / total * 100, 1),
            "avg_duration_ms": round(sum(durations) / len(durations), 1) if durations else 0.0,
            "p95_duration_ms": round(p95, 1),
            "llm_usage_rate_pct": round(len(llm_traces) / total * 100, 1),
            "intent_distribution": _dist("intent"),
            "disposition_distribution": _dist("clinical_disposition"),
            "severity_distribution": _dist("overall_severity"),
            "pipeline_path_distribution": _dist("pipeline_path"),
            "avg_span_durations_ms": avg_spans,
            "avg_llm_duration_ms": round(
                sum(all_llm_durations) / len(all_llm_durations), 1
            ) if all_llm_durations else 0.0,
            "subagent_usage": subagent_counts,
        }


# Global singleton
tracer = AgentTracer()
