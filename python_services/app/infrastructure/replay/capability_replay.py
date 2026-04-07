"""Record and compare external capability invocations."""

from __future__ import annotations

from datetime import UTC, datetime
import json
import os
from pathlib import Path
from typing import Any


def _default_replay_dir() -> Path:
    return Path(__file__).resolve().parents[4] / ".runlogs" / "capability-replays"


def resolve_replay_dir() -> Path:
    configured = os.getenv("CAPABILITY_REPLAY_DIR", "").strip()
    return Path(configured).resolve() if configured else _default_replay_dir()


def record_replay_artifact(
    *,
    trace_id: str,
    provider: str,
    capability: str,
    operation: str,
    request_payload: dict[str, Any],
    result_summary: dict[str, Any],
    diagnostics: dict[str, Any],
    outcome: str,
    elapsed_ms: int,
    config_fingerprint: str,
    environment: str,
) -> Path:
    replay_dir = resolve_replay_dir()
    replay_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S%fZ")
    target = replay_dir / f"{timestamp}_{trace_id}_{capability}_{operation}.json"
    payload = {
        "traceId": trace_id,
        "provider": provider,
        "capability": capability,
        "operation": operation,
        "requestPayload": request_payload,
        "resultSummary": result_summary,
        "diagnostics": diagnostics,
        "outcome": outcome,
        "elapsedMs": elapsed_ms,
        "configFingerprint": config_fingerprint,
        "environment": environment,
        "recordedAt": datetime.now(UTC).isoformat(),
    }
    target.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    return target


def load_replay_artifact(path: str | Path) -> dict[str, Any]:
    target = Path(path)
    return json.loads(target.read_text(encoding="utf-8"))


def compare_replay_outcomes(left: dict[str, Any], right: dict[str, Any]) -> bool:
    semantic_fields = (
        "provider",
        "capability",
        "operation",
        "outcome",
    )
    if any(left.get(field) != right.get(field) for field in semantic_fields):
        return False

    if left.get("outcome") == "failure":
        return (
            left.get("resultSummary", {}).get("code")
            == right.get("resultSummary", {}).get("code")
            and left.get("resultSummary", {}).get("failurePhase")
            == right.get("resultSummary", {}).get("failurePhase")
        )

    return True
