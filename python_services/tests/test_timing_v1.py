"""Tests for timing v1 bars and signal endpoints."""

from __future__ import annotations

from unittest.mock import patch

import pandas as pd
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _sample_history() -> pd.DataFrame:
    dates = pd.date_range("2026-01-02", periods=80, freq="B")
    records: list[dict[str, object]] = []

    for index, value in enumerate(dates):
        base_close = 10 + index * 0.08
        records.append(
            {
                "日期": value.strftime("%Y-%m-%d"),
                "股票代码": "600519",
                "开盘": base_close - 0.05,
                "收盘": base_close,
                "最高": base_close + 0.12,
                "最低": base_close - 0.15,
                "成交量": 1_000_000 + (index * 10_000),
                "成交额": (1_000_000 + (index * 10_000)) * base_close,
                "换手率": 1.2,
            }
        )

    return pd.DataFrame.from_records(records)


def test_get_timing_bars_success() -> None:
    with (
        patch(
            "app.providers.akshare.client.AkShareProviderClient.get_stock_snapshot",
            return_value={"code": "600519", "name": "贵州茅台"},
        ),
        patch(
            "app.providers.akshare.client.AkShareProviderClient.get_stock_bars",
            return_value=_sample_history(),
        ),
    ):
        response = client.get("/api/v1/timing/stocks/600519/bars")

    assert response.status_code == 200
    payload = response.json()
    assert payload["data"]["stockCode"] == "600519"
    assert payload["data"]["stockName"] == "贵州茅台"
    assert payload["data"]["timeframe"] == "DAILY"
    assert len(payload["data"]["bars"]) == 80


def test_get_timing_signal_success() -> None:
    with (
        patch(
            "app.providers.akshare.client.AkShareProviderClient.get_stock_snapshot",
            return_value={"code": "600519", "name": "贵州茅台"},
        ),
        patch(
            "app.providers.akshare.client.AkShareProviderClient.get_stock_bars",
            return_value=_sample_history(),
        ),
    ):
        response = client.get("/api/v1/timing/stocks/600519/signals")

    assert response.status_code == 200
    payload = response.json()
    assert payload["data"]["stockCode"] == "600519"
    assert payload["data"]["barsCount"] == 80
    assert payload["data"]["indicators"]["ema20"] > 0
    assert payload["data"]["ruleSummary"]["direction"] in {
        "bullish",
        "neutral",
        "bearish",
    }


def test_get_timing_signal_batch_reports_partial_errors() -> None:
    def mock_snapshot(stock_code: str):
        if stock_code == "000001":
            raise Exception("upstream unavailable")
        return {"code": "600519", "name": "贵州茅台"}

    with (
        patch(
            "app.providers.akshare.client.AkShareProviderClient.get_stock_snapshot",
            side_effect=mock_snapshot,
        ),
        patch(
            "app.providers.akshare.client.AkShareProviderClient.get_stock_bars",
            return_value=_sample_history(),
        ),
    ):
        response = client.post(
            "/api/v1/timing/stocks/signals/batch",
            json={"stockCodes": ["600519", "000001"]},
        )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["data"]["items"]) == 1
    assert payload["data"]["items"][0]["stockCode"] == "600519"
    assert len(payload["data"]["errors"]) == 1
    assert payload["data"]["errors"][0]["stockCode"] == "000001"
    assert any(
        warning["code"] == "partial_results"
        for warning in payload["meta"]["warnings"]
    )


def test_get_timing_bars_rejects_invalid_timeframe() -> None:
    response = client.get(
        "/api/v1/timing/stocks/600519/bars",
        params={"timeframe": "WEEKLY"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_timeframe"


def test_get_market_regime_snapshot_success() -> None:
    with (
        patch(
            "app.providers.akshare.client.AkShareProviderClient.get_stock_universe",
            return_value=[
                {
                    "code": "600519",
                    "name": "贵州茅台",
                    "changePercent": 2.5,
                    "turnoverRate": 1.1,
                },
                {
                    "code": "000001",
                    "name": "平安银行",
                    "changePercent": -1.6,
                    "turnoverRate": 0.8,
                },
                {
                    "code": "300750",
                    "name": "宁德时代",
                    "changePercent": 5.8,
                    "turnoverRate": 2.4,
                },
            ],
        ),
        patch(
            "app.providers.akshare.client.AkShareProviderClient.get_stock_snapshot",
            side_effect=lambda stock_code: {"code": stock_code, "name": stock_code},
        ),
        patch(
            "app.providers.akshare.client.AkShareProviderClient.get_stock_bars",
            return_value=_sample_history(),
        ),
    ):
        response = client.get("/api/v1/timing/market/regime-snapshot")

    assert response.status_code == 200
    payload = response.json()
    assert payload["data"]["breadth"]["totalCount"] == 3
    assert len(payload["data"]["indexes"]) == 3
    assert payload["data"]["features"]["benchmarkStrength"] >= 0
