"""Provider client backed by AkShare adapters and strict intelligence loaders."""

from __future__ import annotations

import re

import akshare as ak
import pandas as pd

from app.gateway.common import GatewayError
from app.services.akshare_adapter import AkShareAdapter
from app.services.intelligence_data_adapter import IntelligenceDataAdapter

_ETF_PREFIXES = (
    "15",
    "16",
    "18",
    "50",
    "51",
    "52",
    "56",
    "58",
    "159",
)

_CONCEPT_NAME_COLUMNS = (
    "\u677f\u5757\u540d\u79f0",
    "\u6982\u5ff5\u540d\u79f0",
)
_CONCEPT_CODE_COLUMNS = (
    "\u677f\u5757\u4ee3\u7801",
    "\u4ee3\u7801",
)
_CONCEPT_LEADING_COLUMNS = (
    "\u9886\u6da8\u80a1\u7968",
    "\u9886\u6da8",
)
_CONCEPT_CHANGE_COLUMN = "\u6da8\u8dcc\u5e45"
_CONCEPT_UP_COUNT_COLUMN = "\u4e0a\u6da8\u5bb6\u6570"
_CONCEPT_DOWN_COUNT_COLUMN = "\u4e0b\u8dcc\u5bb6\u6570"

_STOCK_CODE_COLUMN = "\u4ee3\u7801"
_STOCK_NAME_COLUMN = "\u540d\u79f0"
_STOCK_LATEST_PRICE_COLUMN = "\u6700\u65b0\u4ef7"
_STOCK_CHANGE_PERCENT_COLUMN = "\u6da8\u8dcc\u5e45"
_STOCK_TURNOVER_RATE_COLUMN = "\u6362\u624b\u7387"


class AkShareProviderClient:
    provider_name = "akshare"

    def get_all_stock_codes(self) -> list[str]:
        code_table_error: Exception | None = None

        try:
            codes = _extract_stock_codes_from_frame(
                AkShareAdapter.get_stock_code_name_frame()
            )
            if codes:
                return codes
            code_table_error = RuntimeError("stock code table returned empty payload")
        except Exception as exc:  # noqa: BLE001
            code_table_error = exc

        try:
            return AkShareAdapter.get_all_stock_codes()
        except Exception as exc:  # noqa: BLE001
            detail = str(code_table_error) if code_table_error is not None else "unknown error"
            raise Exception(
                "failed to load stock codes: "
                f"dedicated code table failed: {detail}; "
                f"spot fallback failed: {exc}"
            ) from exc

    def get_stock_universe(self) -> list[dict]:
        return AkShareAdapter.get_stock_universe()

    def get_stock_snapshot(self, stock_code: str) -> dict:
        normalized_code = _normalize_stock_code(stock_code)
        if _is_etf_code(normalized_code):
            item = AkShareAdapter.get_etf_by_code(normalized_code)
            if item:
                return item
            raise GatewayError(
                code="stock_not_found",
                message=f"Security not found: {normalized_code}",
                status_code=404,
                provider=self.provider_name,
            )

        items = AkShareAdapter.get_stocks_by_codes([normalized_code])
        if not items:
            raise GatewayError(
                code="stock_not_found",
                message=f"Stock not found: {normalized_code}",
                status_code=404,
                provider=self.provider_name,
            )

        return items[0]

    def get_stock_batch(self, stock_codes: list[str]) -> list[dict]:
        normalized_codes = [_normalize_stock_code(code) for code in stock_codes]
        normalized_codes = [code for code in normalized_codes if code]
        if not normalized_codes:
            return []

        etf_codes = [code for code in normalized_codes if _is_etf_code(code)]
        etf_code_set = set(etf_codes)
        equity_codes = [code for code in normalized_codes if code not in etf_code_set]

        items_by_code: dict[str, dict] = {}
        for item in AkShareAdapter.get_stocks_by_codes(equity_codes):
            code = str(item.get("code") or "").strip()
            if code:
                items_by_code[code] = item

        for item in AkShareAdapter.get_etf_batch(etf_codes):
            code = str(item.get("code") or "").strip()
            if code:
                items_by_code[code] = item

        return [items_by_code[code] for code in normalized_codes if code in items_by_code]

    def get_available_industries(self) -> list[str]:
        return AkShareAdapter.get_available_industries()

    def get_indicator_history(
        self,
        stock_code: str,
        indicator: str,
        years: int,
    ) -> list[dict]:
        return AkShareAdapter.get_indicator_history(stock_code, indicator, years)

    def get_stock_bars(
        self,
        *,
        stock_code: str,
        start_date: str | None,
        end_date: str | None,
        adjust: str,
    ) -> pd.DataFrame:
        normalized_code = _normalize_stock_code(stock_code)
        normalized_start = _normalize_ymd(start_date) or "19700101"
        normalized_end = _normalize_ymd(end_date) or "20500101"

        if _is_etf_code(normalized_code):
            fetch_fn = lambda: ak.fund_etf_hist_em(
                symbol=normalized_code,
                period="daily",
                start_date=normalized_start,
                end_date=normalized_end,
                adjust=adjust,
            )
        else:
            fetch_fn = lambda: ak.stock_zh_a_hist(
                symbol=normalized_code,
                period="daily",
                start_date=normalized_start,
                end_date=normalized_end,
                adjust=adjust,
            )

        try:
            frame = fetch_fn()
        except Exception as exc:  # noqa: BLE001
            raise GatewayError(
                code="bars_unavailable",
                message=f"Failed to load daily bars for {normalized_code}: {exc}",
                status_code=503,
                provider=self.provider_name,
            ) from exc

        if frame.empty:
            raise GatewayError(
                code="bars_not_found",
                message=f"Daily bars not found for {normalized_code}",
                status_code=404,
                provider=self.provider_name,
            )

        return frame

    def get_theme_candidates(self, theme: str, limit: int) -> list[dict]:
        return IntelligenceDataAdapter.get_candidates_strict(theme=theme, limit=limit)

    def get_theme_news(self, theme: str, days: int, limit: int) -> list[dict]:
        return IntelligenceDataAdapter.get_theme_news_strict(
            theme=theme,
            days=days,
            limit=limit,
        )

    def get_theme_concepts(self, theme: str, limit: int) -> dict:
        return IntelligenceDataAdapter.match_theme_concepts(theme=theme, limit=limit)

    def get_stock_evidence(self, stock_code: str, concept: str | None) -> dict:
        return IntelligenceDataAdapter.get_company_evidence_strict(
            stock_code=stock_code,
            concept=concept,
        )

    def get_stock_research_pack(self, stock_code: str, concept: str | None) -> dict:
        return IntelligenceDataAdapter.get_company_research_pack_strict(
            stock_code=stock_code,
            concept=concept,
        )

    def get_concept_catalog(self) -> list[dict]:
        df = AkShareAdapter.get_concept_catalog_frame()
        if df.empty:
            return []

        items: list[dict] = []
        for _, row in df.iterrows():
            items.append(
                {
                    "conceptName": _first_non_empty_text(row, _CONCEPT_NAME_COLUMNS),
                    "conceptCode": _first_non_empty_text(row, _CONCEPT_CODE_COLUMNS),
                    "leadingStock": _first_non_empty_text(row, _CONCEPT_LEADING_COLUMNS),
                    "changePercent": _safe_float(row.get(_CONCEPT_CHANGE_COLUMN)),
                    "upCount": _safe_int(row.get(_CONCEPT_UP_COUNT_COLUMN)),
                    "downCount": _safe_int(row.get(_CONCEPT_DOWN_COUNT_COLUMN)),
                }
            )
        return [item for item in items if item["conceptName"]]

    def get_concept_constituents(
        self,
        concept_name: str,
        concept_code: str | None = None,
    ) -> list[dict]:
        df = AkShareAdapter.get_concept_constituents_frame(
            concept_name,
            concept_code=concept_code,
        )
        if df.empty:
            return []

        items: list[dict] = []
        for _, row in df.iterrows():
            items.append(
                {
                    "conceptName": concept_name,
                    "stockCode": str(row.get(_STOCK_CODE_COLUMN) or "").strip(),
                    "stockName": str(row.get(_STOCK_NAME_COLUMN) or "").strip(),
                    "latestPrice": _safe_float(row.get(_STOCK_LATEST_PRICE_COLUMN)),
                    "changePercent": _safe_float(row.get(_STOCK_CHANGE_PERCENT_COLUMN)),
                    "turnoverRate": _safe_float(row.get(_STOCK_TURNOVER_RATE_COLUMN)),
                }
            )
        return [item for item in items if item["stockCode"]]


def _normalize_ymd(value: str | None) -> str | None:
    if not value:
        return None

    matched = re.search(r"(\d{4})-?(\d{2})-?(\d{2})", value)
    if not matched:
        return None

    return "".join(matched.groups())


def _normalize_stock_code(value: str | None) -> str:
    if not value:
        return ""

    matched = re.search(r"(\d{6})", str(value).upper())
    return matched.group(1) if matched else ""


def _is_etf_code(stock_code: str) -> bool:
    return any(stock_code.startswith(prefix) for prefix in _ETF_PREFIXES)


def _extract_stock_codes_from_frame(frame: pd.DataFrame) -> list[str]:
    if frame.empty:
        return []

    code_column = _find_stock_code_column(frame)
    if code_column is None:
        return []

    codes: list[str] = []
    seen: set[str] = set()
    for raw_code in frame[code_column].tolist():
        code = _normalize_stock_code(raw_code)
        if not code or code in seen:
            continue
        seen.add(code)
        codes.append(code)
    return codes


def _find_stock_code_column(frame: pd.DataFrame) -> str | None:
    exact_code_column = next(
        (
            str(column)
            for column in frame.columns
            if _normalize_column_name(column) == "code"
        ),
        None,
    )
    if exact_code_column is not None:
        return exact_code_column

    best_column: str | None = None
    best_score = 0.0
    for column in frame.columns:
        values = [value for value in frame[column].tolist() if str(value or "").strip()]
        if not values:
            continue
        sample = values[:50]
        matched = sum(1 for value in sample if _normalize_stock_code(str(value)) != "")
        score = matched / len(sample)
        if matched >= 3 and score > best_score:
            best_column = str(column)
            best_score = score

    return best_column if best_score >= 0.6 else None


def _normalize_column_name(value: object) -> str:
    return re.sub(r"[^0-9a-z\u4e00-\u9fff]", "", str(value or "").strip().lower())


def _first_non_empty_text(row: pd.Series, columns: tuple[str, ...]) -> str:
    for column in columns:
        text = str(row.get(column) or "").strip()
        if text:
            return text
    return ""


def _safe_float(value: object) -> float | None:
    if value is None:
        return None

    try:
        return float(str(value).replace("%", "").strip())
    except (TypeError, ValueError):
        return None


def _safe_int(value: object) -> int | None:
    if value is None:
        return None

    try:
        return int(float(str(value).strip()))
    except (TypeError, ValueError):
        return None
