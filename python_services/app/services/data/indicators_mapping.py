"""Minimal indicator mapping snapshot for screening workbench."""

FINANCIAL_STATEMENT_CATEGORIES = {
    "profitability": {
        "name": "盈利能力",
        "indicators": {
            "ROE(TTM)": "ths_roe_ttm_stock",
            "EPS(TTM)": "ths_eps_ttm_stock",
            "资产负债率": "ths_asset_liab_ratio_stock",
        },
    },
    "valuation": {
        "name": "估值水平",
        "indicators": {
            "PE(TTM)": "ths_pe_ttm_stock",
            "PB": "ths_pb_latest_stock",
        },
    },
    "growth": {
        "name": "成长质量",
        "indicators": {
            "营业收入": "ths_revenue_stock",
            "归母净利润": "ths_np_atoopc_stock",
        },
    },
    "capital": {
        "name": "股本结构",
        "indicators": {
            "总股本": "ths_total_shares_stock",
            "流通A股": "ths_float_ashare_stock",
        },
    },
}
