"""TuShare-backed market context provider."""

from __future__ import annotations

from datetime import date, timedelta
from importlib.util import find_spec
import os
from typing import Any

import pandas as pd


def _create_tushare_client(token: str):
    if find_spec("tushare") is None:
        raise RuntimeError("tushare SDK is not installed")

    import tushare as ts  # pragma: no cover

    return ts.pro_api(token)


def _pick_first_numeric(row: pd.Series, candidates: list[str]) -> float | None:
    for key in candidates:
        if key not in row:
            continue
        value = row.get(key)
        if value is None or value == "":
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return None


def _pick_first_text(row: pd.Series, candidates: list[str]) -> str | None:
    for key in candidates:
        if key not in row:
            continue
        value = row.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return None


def _latest_row(frame: pd.DataFrame) -> pd.Series:
    if frame.empty:
        raise RuntimeError("Tushare dataset is empty")

    sort_column = next(
        (
            column
            for column in ["trade_date", "month", "quarter", "ann_date", "end_date"]
            if column in frame.columns
        ),
        None,
    )
    if sort_column:
        return frame.sort_values(sort_column, ascending=False).iloc[0]

    return frame.iloc[0]


class TushareMarketContextProvider:
    provider_name = "tushare"

    def __init__(self, *, token: str | None = None) -> None:
        self._token = token
        self._client = None

    def get_macro_snapshot(self) -> dict[str, Any]:
        client = self._get_client()

        gdp_row = _latest_row(client.cn_gdp())
        m2_row = _latest_row(client.cn_m())
        sf_row = _latest_row(client.sf_month())
        pmi_row = _latest_row(client.cn_pmi())

        as_of = max(
            filter(
                None,
                [
                    _pick_first_text(gdp_row, ["quarter", "ann_date"]),
                    _pick_first_text(m2_row, ["month"]),
                    _pick_first_text(sf_row, ["month"]),
                    _pick_first_text(pmi_row, ["month"]),
                ],
            ),
            default=date.today().strftime("%Y%m%d"),
        )

        return {
            "asOf": as_of,
            "gdpYoY": _pick_first_numeric(gdp_row, ["gdp_yoy"]),
            "m2YoY": _pick_first_numeric(m2_row, ["m2_yoy"]),
            "socialFinancingIncrement": _pick_first_numeric(sf_row, ["inc_month"]),
            "manufacturingPmi": _pick_first_numeric(pmi_row, ["pmi010000", "pmi"]),
        }

    def get_hsgt_flow_snapshot(self) -> dict[str, Any]:
        client = self._get_client()
        end_date = date.today()
        start_date = end_date - timedelta(days=14)
        frame = client.moneyflow_hsgt(
            start_date=start_date.strftime("%Y%m%d"),
            end_date=end_date.strftime("%Y%m%d"),
        )
        row = _latest_row(frame)
        return {
            "asOf": _pick_first_text(row, ["trade_date"]) or end_date.strftime("%Y%m%d"),
            "northboundNetAmount": _pick_first_numeric(row, ["north_money"]),
            "southboundNetAmount": _pick_first_numeric(row, ["south_money"]),
        }

    def _get_client(self):
        if self._client is not None:
            return self._client

        token = self._token or os.getenv("TUSHARE_TOKEN", "").strip()
        if not token:
            raise RuntimeError("Missing TUSHARE_TOKEN")

        self._client = _create_tushare_client(token)
        return self._client
