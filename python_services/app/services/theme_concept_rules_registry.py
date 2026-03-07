"""Theme concept rules registry backed by local JSON file."""

from __future__ import annotations

from datetime import UTC, datetime
import json
import os
from pathlib import Path
import threading
from typing import Any


class ThemeConceptRulesRegistry:
    """Store and query theme -> concept rule records."""

    def __init__(self, file_path: str | None = None) -> None:
        env_path = os.getenv("INTELLIGENCE_THEME_CONCEPT_RULES_FILE", "").strip()
        default_path = Path(__file__).resolve().parent / "data" / "theme_concept_rules.json"
        target_path = file_path or env_path or str(default_path)
        self.file_path = Path(target_path)
        self._lock = threading.Lock()

    def get_rules(self, theme: str) -> dict:
        normalized_theme = _normalize_theme(theme)
        if not normalized_theme:
            return _empty_rule(theme="")

        records = self._load_records()
        matched = self._find_record(records, normalized_theme)
        if not matched:
            return _empty_rule(theme=theme.strip())

        return _sanitize_record(matched)

    def upsert_rules(
        self,
        theme: str,
        whitelist: list[str] | None = None,
        blacklist: list[str] | None = None,
        aliases: list[str] | None = None,
    ) -> dict:
        normalized_theme = _normalize_theme(theme)
        if not normalized_theme:
            raise ValueError("theme 不能为空")

        cleaned_whitelist = _clean_name_list(whitelist)
        cleaned_blacklist = _clean_name_list(blacklist)
        cleaned_aliases = [
            alias
            for alias in _clean_name_list(aliases)
            if _normalize_theme(alias) != normalized_theme
        ]

        with self._lock:
            records = self._load_records_unlocked()
            record = self._find_record(records, normalized_theme)
            now = datetime.now(UTC).isoformat()

            if record is None:
                record = {
                    "theme": theme.strip(),
                    "whitelist": cleaned_whitelist,
                    "blacklist": cleaned_blacklist,
                    "aliases": cleaned_aliases,
                    "updatedAt": now,
                }
                records.append(record)
            else:
                record["theme"] = theme.strip() or record.get("theme", "")
                record["whitelist"] = cleaned_whitelist
                record["blacklist"] = cleaned_blacklist
                record["aliases"] = cleaned_aliases
                record["updatedAt"] = now

            self._save_records_unlocked(records)
            return _sanitize_record(record)

    def _find_record(self, records: list[dict], normalized_theme: str) -> dict | None:
        for record in records:
            theme_name = _normalize_theme(record.get("theme"))
            if theme_name == normalized_theme:
                return record

        for record in records:
            aliases = record.get("aliases")
            if not isinstance(aliases, list):
                continue
            normalized_aliases = {_normalize_theme(alias) for alias in aliases}
            if normalized_theme in normalized_aliases:
                return record

        return None

    def _load_records(self) -> list[dict]:
        with self._lock:
            return self._load_records_unlocked()

    def _load_records_unlocked(self) -> list[dict]:
        if not self.file_path.exists():
            return []

        try:
            payload = json.loads(self.file_path.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            return []

        items = payload.get("items") if isinstance(payload, dict) else None
        if not isinstance(items, list):
            return []

        normalized_items: list[dict] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            sanitized = _sanitize_record(item)
            if sanitized["theme"]:
                normalized_items.append(sanitized)

        return normalized_items

    def _save_records_unlocked(self, records: list[dict]) -> None:
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": 1,
            "items": [_sanitize_record(record) for record in records if record],
        }
        tmp_path = self.file_path.with_suffix(".tmp")
        tmp_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        tmp_path.replace(self.file_path)


def _empty_rule(theme: str) -> dict:
    return {
        "theme": theme,
        "whitelist": [],
        "blacklist": [],
        "aliases": [],
        "updatedAt": None,
    }


def _sanitize_record(record: dict[str, Any]) -> dict:
    theme = str(record.get("theme") or "").strip()
    return {
        "theme": theme,
        "whitelist": _clean_name_list(record.get("whitelist")),
        "blacklist": _clean_name_list(record.get("blacklist")),
        "aliases": _clean_name_list(record.get("aliases")),
        "updatedAt": str(record.get("updatedAt") or "").strip() or None,
    }


def _clean_name_list(raw_value: Any) -> list[str]:
    if raw_value is None:
        return []

    if isinstance(raw_value, str):
        source_items = [raw_value]
    elif isinstance(raw_value, list):
        source_items = [str(item) for item in raw_value]
    else:
        return []

    cleaned: list[str] = []
    seen: set[str] = set()
    for raw_item in source_items:
        text = str(raw_item).strip()
        if not text:
            continue
        normalized = _normalize_theme(text)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        cleaned.append(text)

    return cleaned


def _normalize_theme(text: Any) -> str:
    if text is None:
        return ""
    return str(text).strip().lower().replace(" ", "")
