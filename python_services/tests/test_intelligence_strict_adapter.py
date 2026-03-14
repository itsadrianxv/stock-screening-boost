from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pandas as pd
import pytest

from app.services import intelligence_data_adapter as adapter_module
from app.services.intelligence_data_adapter import IntelligenceDataAdapter


def setup_function() -> None:
    adapter_module._CACHE.clear()
    adapter_module._SPOT_CACHE = None


def _concept_df() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "name": ["AI compute"],
            "code": ["BK001"],
            "change": [2.1],
        }
    )


def test_get_candidates_strict_raises_when_no_theme_specific_candidates():
    with (
        patch(
            "app.services.intelligence_data_adapter.ak.stock_board_concept_name_em",
            return_value=_concept_df(),
        ),
        patch(
            "app.services.intelligence_data_adapter.ak.stock_board_concept_cons_em",
            side_effect=Exception("upstream down"),
        ),
        patch(
            "app.services.intelligence_data_adapter._RULES_REGISTRY.get_rules",
            return_value={"theme": "AI", "whitelist": [], "blacklist": [], "aliases": []},
        ),
        patch(
            "app.services.intelligence_data_adapter._ZHIPU_SEARCH_CLIENT.search_theme_concepts",
            return_value=[],
        ),
    ):
        with pytest.raises(ValueError, match="暂无可用候选股数据"):
            IntelligenceDataAdapter.get_candidates_strict(theme="AI", limit=5)


@patch("app.services.intelligence_data_adapter._fetch_candidates_from_akshare")
@patch("app.services.intelligence_data_adapter.ak.stock_news_em")
def test_get_theme_news_strict_filters_by_days(mock_stock_news, mock_candidates):
    now = datetime.now(UTC)
    recent = (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")
    stale = (now - timedelta(days=20)).strftime("%Y-%m-%d %H:%M:%S")

    mock_candidates.return_value = [
        {
            "stockCode": "603019",
            "stockName": "Test Corp",
            "reason": "Test reason",
            "heat": 80,
            "concept": "AI compute",
        }
    ]
    mock_stock_news.return_value = pd.DataFrame(
        {
            "title": ["Recent news", "Stale news"],
            "content": ["Recent summary", "Stale summary"],
            "date": [recent, stale],
            "source": ["test-source", "test-source"],
            "url": ["https://example.com/recent", "https://example.com/stale"],
        }
    )

    payload = IntelligenceDataAdapter.get_theme_news_strict(theme="AI", days=7, limit=10)

    assert len(payload) == 1
    assert payload[0]["title"] == "Recent news"


@patch("app.services.intelligence_data_adapter._fetch_theme_news_from_akshare")
def test_get_theme_news_strict_falls_back_to_mock_news_on_empty_result(
    mock_fetch_theme_news,
):
    mock_fetch_theme_news.return_value = []

    theme = "chip equipment import substitution, key milestones?"
    payload = IntelligenceDataAdapter.get_theme_news_strict(
        theme=theme,
        days=7,
        limit=3,
    )

    assert len(payload) == 3
    assert all(item["source"] == "intelligence-fallback" for item in payload)
    assert all(theme in item["title"] for item in payload)


@patch("app.services.intelligence_data_adapter._get_spot_snapshot")
def test_get_company_evidence_strict_raises_without_mock_fallback(mock_spot_snapshot):
    mock_spot_snapshot.side_effect = ValueError("spot unavailable")

    with pytest.raises(ValueError, match="spot unavailable"):
        IntelligenceDataAdapter.get_company_evidence_strict("603019", "AI")
