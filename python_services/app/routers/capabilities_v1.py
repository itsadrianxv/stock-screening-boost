"""Unified external capability routes."""

from __future__ import annotations

import hashlib
import json
import os
import platform
import time
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.contracts.capability import (
    CapabilityErrorResponse,
    CapabilityMeta,
    CapabilityResponse,
    ConceptMatchCapabilityRequest,
    ScreeningQueryCapabilityRequest,
    WebFetchCapabilityRequest,
    WebSearchCapabilityRequest,
)
from app.gateway.external_capability_gateway import (
    CapabilityError,
    CapabilityResult,
    external_capability_gateway,
)
from app.infrastructure.replay.capability_replay import record_replay_artifact

router = APIRouter(prefix="/api/v1/capabilities", tags=["capabilities-v1"])


def _build_environment_fingerprint() -> str:
    return platform.node() or os.getenv("COMPOSE_PROJECT_NAME", "") or "unknown"


def _build_config_fingerprint(diagnostics: dict[str, Any]) -> str:
    payload = json.dumps(diagnostics, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:12]


def _record_success(
    *,
    request_id: str,
    payload: dict[str, Any],
    result: CapabilityResult[Any],
    elapsed_ms: int,
) -> None:
    record_replay_artifact(
        trace_id=request_id,
        provider=result.provider,
        capability=result.capability,
        operation=result.operation,
        request_payload=payload,
        result_summary={"outcome": "success"},
        diagnostics=result.diagnostics,
        outcome="success",
        elapsed_ms=elapsed_ms,
        config_fingerprint=_build_config_fingerprint(result.diagnostics),
        environment=_build_environment_fingerprint(),
    )


def _record_failure(
    *,
    request_id: str,
    payload: dict[str, Any],
    error: CapabilityError,
    elapsed_ms: int,
) -> None:
    record_replay_artifact(
        trace_id=request_id,
        provider=error.provider,
        capability=error.capability,
        operation=error.operation,
        request_payload=payload,
        result_summary={
            "outcome": "failure",
            "code": error.code,
            "failurePhase": error.failure_phase,
        },
        diagnostics=error.diagnostics,
        outcome="failure",
        elapsed_ms=elapsed_ms,
        config_fingerprint=_build_config_fingerprint(error.diagnostics),
        environment=_build_environment_fingerprint(),
    )


def _build_success_response(
    request_id: str,
    result: CapabilityResult[Any],
    elapsed_ms: int,
) -> CapabilityResponse:
    return CapabilityResponse(
        meta=CapabilityMeta(
            traceId=request_id,
            provider=result.provider,
            capability=result.capability,
            operation=result.operation,
            retryable=result.retryable,
            failurePhase=result.failure_phase,
            diagnostics=result.diagnostics,
            elapsedMs=max(0, elapsed_ms),
        ),
        data=result.data,
    )


def _build_error_response(request_id: str, error: CapabilityError) -> CapabilityErrorResponse:
    return CapabilityErrorResponse(
        error={
            "traceId": request_id,
            "provider": error.provider,
            "capability": error.capability,
            "operation": error.operation,
            "code": error.code,
            "message": error.message,
            "retryable": error.retryable,
            "failurePhase": error.failure_phase,
            "diagnostics": error.diagnostics,
        }
    )


def _handle_capability_call(
    *,
    request: Request,
    payload: dict[str, Any],
    runner,
):
    started_at = time.perf_counter()
    request_id = request.state.request_id
    try:
        result = runner(request_id, payload)
        elapsed_ms = int((time.perf_counter() - started_at) * 1000)
        _record_success(
            request_id=request_id,
            payload=payload,
            result=result,
            elapsed_ms=elapsed_ms,
        )
        return _build_success_response(request_id, result, elapsed_ms)
    except CapabilityError as error:
        elapsed_ms = int((time.perf_counter() - started_at) * 1000)
        _record_failure(
            request_id=request_id,
            payload=payload,
            error=error,
            elapsed_ms=elapsed_ms,
        )
        return JSONResponse(
            status_code=error.status_code,
            content=_build_error_response(request_id, error).model_dump(mode="json"),
        )


@router.post("/screening/query-dataset", response_model=CapabilityResponse)
def query_screening_dataset(request: Request, body: ScreeningQueryCapabilityRequest):
    return _handle_capability_call(
        request=request,
        payload=body.model_dump(mode="json"),
        runner=external_capability_gateway.query_screening_dataset,
    )


@router.post("/web/search", response_model=CapabilityResponse)
def search_web(request: Request, body: WebSearchCapabilityRequest):
    return _handle_capability_call(
        request=request,
        payload=body.model_dump(mode="json"),
        runner=external_capability_gateway.search_web,
    )


@router.post("/web/fetch", response_model=CapabilityResponse)
def fetch_web_page(request: Request, body: WebFetchCapabilityRequest):
    return _handle_capability_call(
        request=request,
        payload=body.model_dump(mode="json"),
        runner=external_capability_gateway.fetch_web_page,
    )


@router.post("/concepts/match", response_model=CapabilityResponse)
def match_concepts(request: Request, body: ConceptMatchCapabilityRequest):
    return _handle_capability_call(
        request=request,
        payload=body.model_dump(mode="json"),
        runner=external_capability_gateway.match_concepts,
    )
