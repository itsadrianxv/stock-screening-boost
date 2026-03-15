"""AkShareAdapter unit tests."""

from unittest.mock import patch

import pandas as pd
import pytest

from app.services.akshare_adapter import AkShareAdapter, _safe_float


@pytest.fixture(autouse=True)
def clear_adapter_caches():
    AkShareAdapter.clear_caches()
    yield
    AkShareAdapter.clear_caches()


class TestAkShareAdapter:
    def test_safe_float_with_valid_number(self):
        assert _safe_float(15.5) == 15.5
        assert _safe_float("15.5") == 15.5
        assert _safe_float("15.5%") == 15.5

    def test_safe_float_with_invalid_value(self):
        assert _safe_float(None) is None
        assert _safe_float(pd.NA) is None
        assert _safe_float("invalid") is None

    @patch("app.services.akshare_adapter.ak.stock_yjbb_em")
    @patch("app.services.akshare_adapter.ak.stock_zh_a_spot_em")
    def test_shared_spot_cache_reused_across_universe_codes_and_batch(
        self,
        mock_spot,
        mock_yjbb,
    ):
        mock_spot.return_value = pd.DataFrame(
            {
                "代码": ["000001", "600519"],
                "名称": ["平安银行", "贵州茅台"],
                "市盈率-动态": [5.5, 35.5],
                "市净率": [0.8, 10.2],
                "总市值": [2000.0, 21000.0],
                "流通市值": [1900.0, 20500.0],
                "换手率": [1.2, 0.9],
                "涨跌幅": [0.5, 1.5],
            }
        )
        mock_yjbb.return_value = pd.DataFrame()

        codes = AkShareAdapter.get_all_stock_codes()
        stocks = AkShareAdapter.get_stocks_by_codes(["000001"])
        universe = AkShareAdapter.get_stock_universe()

        assert codes == ["000001", "600519"]
        assert len(stocks) == 1
        assert len(universe) == 2
        mock_spot.assert_called_once()

    @patch("app.services.akshare_adapter.ak.stock_yjbb_em")
    @patch("app.services.akshare_adapter.ak.stock_zh_a_spot_em")
    def test_get_stocks_by_codes_prefers_financial_snapshot_fields(
        self,
        mock_spot,
        mock_yjbb,
    ):
        mock_spot.return_value = pd.DataFrame(
            {
                "代码": ["000001"],
                "名称": ["平安银行"],
                "行业": ["错误行业"],
                "市盈率-动态": [5.5],
                "市净率": [0.8],
                "总市值": [2000.0],
                "流通市值": [1900.0],
                "换手率": [1.2],
                "涨跌幅": [0.5],
            }
        )
        mock_yjbb.return_value = pd.DataFrame(
            {
                "股票代码": ["000001"],
                "所处行业": ["银行"],
                "净资产收益率": [12.3],
                "每股收益": [1.5],
                "营业总收入-营业总收入": [1800.0],
                "净利润-净利润": [400.0],
            }
        )

        stocks = AkShareAdapter.get_stocks_by_codes(["000001"])

        assert len(stocks) == 1
        assert stocks[0]["industry"] == "银行"
        assert stocks[0]["roe"] == 12.3
        assert stocks[0]["eps"] == 1.5
        assert stocks[0]["revenue"] == 1800.0
        assert stocks[0]["netProfit"] == 400.0
        assert stocks[0]["pe"] == 5.5
        assert stocks[0]["pb"] == 0.8

    @patch("app.services.akshare_adapter.ak.stock_individual_info_em")
    @patch("app.services.akshare_adapter.ak.stock_yjbb_em")
    @patch("app.services.akshare_adapter.ak.stock_zh_a_spot_em")
    def test_get_stocks_by_codes_uses_individual_info_for_missing_industry(
        self,
        mock_spot,
        mock_yjbb,
        mock_individual_info,
    ):
        mock_spot.return_value = pd.DataFrame(
            {
                "代码": ["600519"],
                "名称": ["贵州茅台"],
                "市盈率-动态": [35.5],
                "市净率": [10.2],
                "总市值": [21000.0],
                "流通市值": [20500.0],
                "换手率": [0.9],
                "涨跌幅": [1.5],
            }
        )
        mock_yjbb.return_value = pd.DataFrame(
            {
                "股票代码": ["600519"],
                "所处行业": [""],
                "净资产收益率": [28.0],
            }
        )
        mock_individual_info.return_value = pd.DataFrame(
            {
                "item": ["行业"],
                "value": ["白酒"],
            }
        )

        stocks = AkShareAdapter.get_stocks_by_codes(["600519"])

        assert len(stocks) == 1
        assert stocks[0]["industry"] == "白酒"
        mock_individual_info.assert_called_once_with(symbol="600519")

    @patch("app.services.akshare_adapter.ak.stock_financial_analysis_indicator_em")
    def test_get_indicator_history_uses_em_source_for_roe(self, mock_em_indicator):
        mock_em_indicator.return_value = pd.DataFrame(
            {
                "REPORT_DATE": ["2024-12-31", "2023-12-31", "2022-12-31"],
                "净资产收益率": [0.25, 0.23, 0.22],
            }
        )

        history = AkShareAdapter.get_indicator_history("600519", "ROE", 2)

        assert history == [
            {"date": "2023-12-31", "value": 0.23, "isEstimated": False},
            {"date": "2024-12-31", "value": 0.25, "isEstimated": False},
        ]

    @patch("app.services.akshare_adapter.ak.stock_financial_benefit_new_ths")
    def test_get_indicator_history_uses_ths_profit_table_for_revenue(
        self,
        mock_benefit,
    ):
        mock_benefit.return_value = pd.DataFrame(
            {
                "report_date": ["2022-12-31", "2023-12-31", "2024-12-31"],
                "metric_name": ["营业总收入", "营业总收入", "营业总收入"],
                "value": [1000.0, 1200.0, 1500.0],
            }
        )

        history = AkShareAdapter.get_indicator_history("600519", "REVENUE", 2)

        assert history == [
            {"date": "2023-12-31", "value": 1200.0, "isEstimated": False},
            {"date": "2024-12-31", "value": 1500.0, "isEstimated": False},
        ]

    @patch("app.services.akshare_adapter.ak.stock_financial_debt_new_ths")
    def test_get_indicator_history_computes_debt_ratio_from_ths_balance_sheet(
        self,
        mock_debt,
    ):
        mock_debt.return_value = pd.DataFrame(
            {
                "report_date": [
                    "2023-12-31",
                    "2023-12-31",
                    "2024-12-31",
                    "2024-12-31",
                ],
                "metric_name": ["总资产", "总负债", "总资产", "总负债"],
                "value": [1000.0, 450.0, 1200.0, 480.0],
            }
        )

        history = AkShareAdapter.get_indicator_history("600519", "DEBT_RATIO", 2)

        assert history == [
            {"date": "2023-12-31", "value": 45.0, "isEstimated": False},
            {"date": "2024-12-31", "value": 40.0, "isEstimated": False},
        ]

    @patch("app.services.akshare_adapter.ak.stock_board_industry_name_em")
    @patch("app.services.akshare_adapter.ak.stock_yjbb_em")
    def test_get_available_industries_prefers_financial_snapshot(
        self,
        mock_yjbb,
        mock_board,
    ):
        mock_yjbb.return_value = pd.DataFrame(
            {
                "股票代码": ["000001", "600519"],
                "所处行业": ["银行", "白酒"],
            }
        )
        mock_board.return_value = pd.DataFrame({"板块名称": ["不会命中"]})

        industries = AkShareAdapter.get_available_industries()

        assert industries == ["白酒", "银行"]
        mock_board.assert_not_called()

    @patch("app.services.akshare_adapter.ak.stock_board_industry_name_em")
    @patch("app.services.akshare_adapter.ak.stock_yjbb_em")
    def test_get_available_industries_falls_back_to_board_list(
        self,
        mock_yjbb,
        mock_board,
    ):
        mock_yjbb.return_value = pd.DataFrame()
        mock_board.return_value = pd.DataFrame({"板块名称": ["银行", "白酒", "医药"]})

        industries = AkShareAdapter.get_available_industries()

        assert industries == ["医药", "白酒", "银行"]
        mock_board.assert_called_once()

    @patch("app.services.akshare_adapter.ak.stock_yjbb_em")
    @patch("app.services.akshare_adapter.ak.stock_zh_a_spot_em")
    def test_get_all_stock_codes_error_handling(self, mock_spot, mock_yjbb):
        mock_spot.side_effect = Exception("Network error")
        mock_yjbb.return_value = pd.DataFrame()

        with pytest.raises(Exception) as exc_info:
            AkShareAdapter.get_all_stock_codes()

        assert "获取股票代码列表失败" in str(exc_info.value)
