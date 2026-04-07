"""Serialized iFinD provider session management."""

from __future__ import annotations

from importlib.util import find_spec
import os
from pathlib import Path
from threading import Lock
from typing import Callable

from app.providers.screening.ifind_provider import IFindScreeningProvider


class IFindSessionManager:
    def __init__(
        self,
        provider_factory: Callable[[], IFindScreeningProvider] = IFindScreeningProvider,
    ) -> None:
        self._provider_factory = provider_factory
        self._provider: IFindScreeningProvider | None = None
        self._lock = Lock()
        self._initialized = False

    def ensure_session(self) -> IFindScreeningProvider:
        if self._initialized and self._provider is not None:
            return self._provider

        with self._lock:
            if self._provider is None:
                self._provider = self._provider_factory()
            if not self._initialized:
                self._provider._ensure_login()  # noqa: SLF001
                self._initialized = True
            return self._provider

    def preflight(self) -> dict[str, object]:
        log_dir = self._guess_log_dir()
        return {
            "sdkAvailable": find_spec("iFinDPy") is not None,
            "hasCredentials": bool(
                os.getenv("IFIND_USERNAME", "").strip()
                and os.getenv("IFIND_PASSWORD", "").strip()
            ),
            "logPath": str(log_dir) if log_dir else "",
            "logPathReadable": bool(log_dir and log_dir.exists()),
        }

    @staticmethod
    def _guess_log_dir() -> Path | None:
        package_spec = find_spec("iFinDAPI")
        if package_spec is None or package_spec.origin is None:
            return None

        package_root = Path(package_spec.origin).resolve().parent
        for candidate in (
            package_root / "Linux" / "bin64" / "logs",
            package_root / "Windows" / "bin" / "x64" / "logs",
        ):
            if candidate.exists():
                return candidate
        return package_root
