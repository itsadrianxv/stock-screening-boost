"""Contracts for external capability gateway routes."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class CapabilityMeta(BaseModel):
    traceId: str
    provider: str
    capability: str
    operation: str
    retryable: bool = False
    failurePhase: str | None = None
    diagnostics: dict[str, Any] = Field(default_factory=dict)
    elapsedMs: int = Field(default=0, ge=0)


class CapabilityResponse(BaseModel):
    meta: CapabilityMeta
    data: Any


class CapabilityErrorBody(BaseModel):
    traceId: str
    provider: str
    capability: str
    operation: str
    code: str
    message: str
    retryable: bool = False
    failurePhase: str
    diagnostics: dict[str, Any] = Field(default_factory=dict)


class CapabilityErrorResponse(BaseModel):
    error: CapabilityErrorBody


class ScreeningQueryCapabilityRequest(BaseModel):
    stockCodes: list[str] = Field(..., min_length=1, max_length=20)
    indicators: list[dict[str, Any]] = Field(default_factory=list)
    formulas: list[dict[str, Any]] = Field(default_factory=list)
    timeConfig: dict[str, str]


class WebSearchCapabilityRequest(BaseModel):
    queries: list[str] = Field(..., min_length=1, max_length=8)
    limit: int = Field(default=5, ge=1, le=10)


class WebFetchCapabilityRequest(BaseModel):
    url: str = Field(..., min_length=1)


class ConceptMatchCapabilityRequest(BaseModel):
    theme: str = Field(..., min_length=1)
    limit: int = Field(default=5, ge=1, le=20)
