"""Local THS concept catalog loader and writer."""

from __future__ import annotations

from pathlib import Path
import os
import threading

import pandas as pd

_CATALOG_FILENAME = "ths_concept_catalog.csv"
_CATALOG_COLUMNS = ("name", "code")
_RAW_CATALOG_COLUMNS = {
    "name": "name",
    "code": "code",
    "板块名称": "name",
    "板块代码": "code",
}

_CACHE_LOCK = threading.Lock()
_CACHED_FRAME: pd.DataFrame | None = None
_CACHED_MTIME_NS: int | None = None
_CACHED_PATH: Path | None = None


def resolve_ths_concept_catalog_path(file_path: str | Path | None = None) -> Path:
    raw_path = str(file_path or "").strip()
    if raw_path:
        return Path(raw_path)

    env_path = os.getenv("INTELLIGENCE_CONCEPT_CATALOG_FILE", "").strip()
    if env_path:
        return Path(env_path)

    candidates = [
        Path.cwd() / "data" / _CATALOG_FILENAME,
        Path.cwd().parent / "data" / _CATALOG_FILENAME,
        Path(__file__).resolve().parents[2] / "data" / _CATALOG_FILENAME,
        Path(__file__).resolve().parents[3] / "data" / _CATALOG_FILENAME,
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate

    return candidates[0]


def load_ths_concept_catalog_frame(file_path: str | Path | None = None) -> pd.DataFrame:
    global _CACHED_FRAME, _CACHED_MTIME_NS, _CACHED_PATH

    catalog_path = resolve_ths_concept_catalog_path(file_path)
    if not catalog_path.exists():
        raise FileNotFoundError(
            f"THS concept catalog file not found: {catalog_path}"
        )

    stat = catalog_path.stat()
    with _CACHE_LOCK:
        if (
            _CACHED_FRAME is not None
            and _CACHED_PATH == catalog_path
            and _CACHED_MTIME_NS == stat.st_mtime_ns
        ):
            return _CACHED_FRAME.copy(deep=True)

    try:
        loaded_frame = pd.read_csv(catalog_path, dtype=str, encoding="utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError(
            f"THS concept catalog file is not valid UTF-8: {catalog_path}"
        ) from exc
    except pd.errors.EmptyDataError as exc:
        raise ValueError(f"THS concept catalog file is empty: {catalog_path}") from exc
    except pd.errors.ParserError as exc:
        raise ValueError(
            f"THS concept catalog file could not be parsed: {catalog_path}"
        ) from exc
    normalized = prepare_ths_concept_catalog_frame(loaded_frame, dedupe=False)

    with _CACHE_LOCK:
        _CACHED_FRAME = normalized
        _CACHED_MTIME_NS = stat.st_mtime_ns
        _CACHED_PATH = catalog_path
        return _CACHED_FRAME.copy(deep=True)


def write_ths_concept_catalog_frame(
    frame: pd.DataFrame,
    output_path: str | Path | None = None,
) -> Path:
    catalog_path = resolve_ths_concept_catalog_path(output_path)
    normalized = prepare_ths_concept_catalog_frame(frame, dedupe=True)

    catalog_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = catalog_path.with_suffix(".tmp")
    normalized.to_csv(temp_path, index=False, encoding="utf-8")
    temp_path.replace(catalog_path)

    clear_ths_concept_catalog_cache()
    return catalog_path


def prepare_ths_concept_catalog_frame(
    frame: pd.DataFrame,
    *,
    dedupe: bool,
) -> pd.DataFrame:
    renamed = frame.rename(columns=_RAW_CATALOG_COLUMNS)
    missing_columns = [
        column for column in _CATALOG_COLUMNS if column not in renamed.columns
    ]
    if missing_columns:
        missing_text = ", ".join(missing_columns)
        raise ValueError(
            f"THS concept catalog file missing required columns: {missing_text}"
        )

    normalized = renamed.loc[:, list(_CATALOG_COLUMNS)].copy()
    for column in _CATALOG_COLUMNS:
        normalized[column] = normalized[column].map(_normalize_cell)

    normalized = normalized[
        (normalized["name"] != "") & (normalized["code"] != "")
    ].reset_index(drop=True)
    if normalized.empty:
        raise ValueError("THS concept catalog file is empty")

    if dedupe:
        normalized["__name_key__"] = normalized["name"].map(_normalize_key)
        normalized["__code_key__"] = normalized["code"].map(_normalize_key)
        normalized = normalized.drop_duplicates(subset=["__name_key__"], keep="first")
        normalized = normalized.drop_duplicates(subset=["__code_key__"], keep="first")
        normalized = normalized.drop(columns=["__name_key__", "__code_key__"])
        normalized = normalized.reset_index(drop=True)
    else:
        _raise_on_duplicate_values(normalized, column="name")
        _raise_on_duplicate_values(normalized, column="code")

    return normalized


def clear_ths_concept_catalog_cache() -> None:
    global _CACHED_FRAME, _CACHED_MTIME_NS, _CACHED_PATH

    with _CACHE_LOCK:
        _CACHED_FRAME = None
        _CACHED_MTIME_NS = None
        _CACHED_PATH = None


def _raise_on_duplicate_values(frame: pd.DataFrame, *, column: str) -> None:
    keys = frame[column].map(_normalize_key)
    duplicate_rows = frame[keys.duplicated(keep=False)]
    if duplicate_rows.empty:
        return

    duplicates = ", ".join(sorted(set(duplicate_rows[column].tolist())))
    raise ValueError(
        f"THS concept catalog file contains duplicate {column} values: {duplicates}"
    )


def _normalize_cell(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalize_key(value: object) -> str:
    return _normalize_cell(value).casefold()
