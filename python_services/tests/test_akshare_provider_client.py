from unittest.mock import patch

import pandas as pd

from app.providers.akshare.client import AkShareProviderClient
from app.services.akshare_adapter import AkShareAdapter


@patch("app.providers.akshare.client.AkShareAdapter.get_all_stock_codes")
@patch("app.providers.akshare.client.AkShareAdapter.get_stock_code_name_frame")
def test_get_all_stock_codes_prefers_dedicated_code_table(
    mock_code_frame,
    mock_fallback_codes,
):
    AkShareAdapter.clear_caches()
    mock_code_frame.return_value = pd.DataFrame(
        {
            "code": ["000001", "600519", "000001"],
            "name": ["pingan", "moutai", "pingan"],
        }
    )

    client = AkShareProviderClient()
    codes = client.get_all_stock_codes()

    assert codes == ["000001", "600519"]
    mock_fallback_codes.assert_not_called()


@patch("app.providers.akshare.client.AkShareAdapter.get_all_stock_codes")
@patch("app.providers.akshare.client.AkShareAdapter.get_stock_code_name_frame")
def test_get_all_stock_codes_handles_exchange_specific_code_columns(
    mock_code_frame,
    mock_fallback_codes,
):
    AkShareAdapter.clear_caches()
    mock_code_frame.return_value = pd.DataFrame(
        {
            "\u8bc1\u5238\u4ee3\u7801": ["600000", "000001", "920000"],
            "\u8bc1\u5238\u7b80\u79f0": ["pfbank", "pingan", "phoenix"],
        }
    )

    client = AkShareProviderClient()
    codes = client.get_all_stock_codes()

    assert codes == ["600000", "000001", "920000"]
    mock_fallback_codes.assert_not_called()


@patch("app.providers.akshare.client.AkShareAdapter.get_all_stock_codes")
@patch("app.providers.akshare.client.AkShareAdapter.get_stock_code_name_frame")
def test_get_all_stock_codes_falls_back_when_dedicated_table_fails(
    mock_code_frame,
    mock_fallback_codes,
):
    AkShareAdapter.clear_caches()
    mock_code_frame.side_effect = Exception("code table unavailable")
    mock_fallback_codes.return_value = ["600519", "000001"]

    client = AkShareProviderClient()
    codes = client.get_all_stock_codes()

    assert codes == ["600519", "000001"]
    mock_fallback_codes.assert_called_once()


@patch("app.providers.akshare.client.ak.stock_zh_a_hist")
def test_get_stock_bars_normalizes_start_and_end_dates(mock_hist):
    mock_hist.return_value = pd.DataFrame(
        {
            "日期": ["2025-01-02"],
            "开盘": [10.0],
            "收盘": [10.5],
            "最高": [10.8],
            "最低": [9.9],
            "成交量": [1000],
        }
    )

    client = AkShareProviderClient()
    client.get_stock_bars(
        stock_code="600519",
        start_date="2025-01-01",
        end_date="2025-03-01",
        adjust="qfq",
    )

    mock_hist.assert_called_once_with(
        symbol="600519",
        period="daily",
        start_date="20250101",
        end_date="20250301",
        adjust="qfq",
    )


@patch("app.providers.akshare.client.ak.stock_zh_a_hist")
@patch("app.providers.akshare.client.ak.fund_etf_hist_em")
def test_get_stock_bars_routes_etf_codes_to_fund_history(
    mock_etf_hist,
    mock_stock_hist,
):
    mock_etf_hist.return_value = pd.DataFrame(
        {
            "日期": ["2025-01-02"],
            "开盘": [4.0],
            "收盘": [4.1],
            "最高": [4.2],
            "最低": [3.9],
            "成交量": [1000],
        }
    )

    client = AkShareProviderClient()
    client.get_stock_bars(
        stock_code="510300",
        start_date="2025-01-01",
        end_date="2025-03-01",
        adjust="qfq",
    )

    mock_etf_hist.assert_called_once_with(
        symbol="510300",
        period="daily",
        start_date="20250101",
        end_date="20250301",
        adjust="qfq",
    )
    mock_stock_hist.assert_not_called()


@patch("app.services.akshare_adapter._load_concept_constituents_frame_ths")
@patch("app.services.akshare_adapter._load_concept_catalog_frame_ths")
def test_concept_loaders_reuse_shared_adapter_cache(mock_catalog, mock_constituents):
    AkShareAdapter.clear_caches()
    mock_catalog.return_value = pd.DataFrame(
        {
            "板块名称": ["AI"],
            "板块代码": ["BK1234"],
            "涨跌幅": [1.2],
            "领涨股票": ["603019"],
            "上涨家数": [8],
            "下跌家数": [2],
        }
    )
    mock_constituents.return_value = pd.DataFrame(
        {
            "代码": ["603019"],
            "名称": ["中科曙光"],
            "最新价": [45.0],
            "涨跌幅": [2.1],
            "换手率": [1.8],
        }
    )

    client = AkShareProviderClient()
    catalog_one = client.get_concept_catalog()
    catalog_two = client.get_concept_catalog()
    members_one = client.get_concept_constituents("AI", concept_code="BK1234")
    members_two = client.get_concept_constituents("AI", concept_code="BK1234")

    assert catalog_one == catalog_two
    assert members_one == members_two
    mock_catalog.assert_called_once()
    mock_constituents.assert_called_once_with("AI", concept_code="BK1234")
