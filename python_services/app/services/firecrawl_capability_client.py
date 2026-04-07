"""Strict Firecrawl adapter for external capability gateway."""

from __future__ import annotations

import os
from typing import Any

import httpx


class FirecrawlCapabilityClient:
    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        timeout_seconds: float | None = None,
    ) -> None:
        self.api_key = (api_key or os.getenv("FIRECRAWL_API_KEY", "")).strip()
        self.base_url = (
            base_url or os.getenv("FIRECRAWL_BASE_URL", "https://api.firecrawl.dev")
        ).rstrip("/")
        self.timeout_seconds = timeout_seconds or float(
            os.getenv("FIRECRAWL_TIMEOUT_MS", "15000")
        ) / 1000

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def diagnostics(self) -> dict[str, Any]:
        return {
            "endpoint": self.base_url,
            "configured": self.is_configured(),
            "timeoutSeconds": self.timeout_seconds,
        }

    def search(self, *, query: str, limit: int) -> list[dict[str, Any]]:
        if not self.api_key:
            raise RuntimeError("FIRECRAWL_API_KEY not configured")

        response = self._request(
            "/v2/search",
            {
                "query": query,
                "limit": limit,
                "scrapeOptions": {"formats": ["markdown"]},
            },
        )
        return [
            {
                "title": item.get("title") or item.get("url") or "Untitled source",
                "url": item.get("url") or "",
                "description": item.get("description"),
                "markdown": item.get("markdown"),
            }
            for item in response.get("data", [])
            if item.get("url")
        ]

    def fetch(self, *, url: str) -> dict[str, Any] | None:
        if not self.api_key:
            raise RuntimeError("FIRECRAWL_API_KEY not configured")

        response = self._request(
            "/v2/scrape",
            {
                "url": url,
                "formats": ["markdown"],
            },
        )
        data = response.get("data")
        if not isinstance(data, dict):
            return None

        metadata = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
        return {
            "title": metadata.get("title") or url,
            "url": metadata.get("sourceURL") or url,
            "markdown": data.get("markdown"),
            "description": metadata.get("description"),
        }

    def _request(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        with httpx.Client(timeout=self.timeout_seconds) as client:
            response = client.post(f"{self.base_url}{path}", json=body, headers=headers)
        response.raise_for_status()
        payload = response.json()
        return payload if isinstance(payload, dict) else {}
