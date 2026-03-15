import os

import akshare as ak
import pytest

from app.services.akshare_adapter import AkShareAdapter


pytestmark = pytest.mark.skipif(
    os.getenv("RUN_AKSHARE_SMOKE") != "1",
    reason="Set RUN_AKSHARE_SMOKE=1 to execute live AkShare smoke tests",
)


def test_stock_zh_a_hist_smoke():
    df = ak.stock_zh_a_hist(
        symbol="000001",
        period="daily",
        start_date="20250101",
        end_date="20250301",
        adjust="qfq",
    )

    assert not df.empty
    assert "日期" in df.columns


def test_stock_board_concept_name_ths_smoke():
    df = ak.stock_board_concept_name_ths()

    assert not df.empty
    assert "name" in df.columns


def test_ths_concept_constituents_adapter_smoke():
    catalog = ak.stock_board_concept_name_ths()
    concept_name = str(catalog.iloc[0]["name"])
    concept_code = str(catalog.iloc[0]["code"])
    df = AkShareAdapter.get_concept_constituents_frame(
        concept_name,
        concept_code=concept_code,
    )

    assert not df.empty
    assert "代码" in df.columns


def test_stock_news_em_smoke():
    df = ak.stock_news_em(symbol="300308")

    assert "新闻标题" in df.columns
