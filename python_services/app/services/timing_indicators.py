"""Deterministic daily timing indicators and rule summary helpers."""

from __future__ import annotations

from datetime import datetime

import pandas as pd

from app.contracts.timing import (
    TimingBollinger,
    TimingIndicators,
    TimingMacd,
    TimingObv,
    TimingRsi,
    TimingRuleSummary,
    TimingSignalData,
)
from app.gateway.common import GatewayError


class TimingIndicatorsService:
    minimum_lookback_days = 120

    def build_signal(
        self,
        *,
        stock_code: str,
        stock_name: str,
        history: pd.DataFrame,
        as_of_date: str | None = None,
    ) -> TimingSignalData:
        normalized = self.normalize_history(history)
        effective = self.slice_as_of(normalized, as_of_date)

        if len(effective.index) < 60:
            raise GatewayError(
                code="insufficient_history",
                message=f"{stock_code} 可用历史数据不足，无法计算择时指标",
                status_code=422,
                provider="akshare",
            )

        enriched = self.calculate_indicators(effective)
        latest = enriched.iloc[-1]

        indicators = TimingIndicators(
            close=self._round_float(latest["close"]),
            macd=TimingMacd(
                dif=self._round_float(latest["macd_dif"]),
                dea=self._round_float(latest["macd_dea"]),
                histogram=self._round_float(latest["macd_hist"]),
            ),
            rsi=TimingRsi(value=self._round_float(latest["rsi14"])),
            bollinger=TimingBollinger(
                upper=self._round_float(latest["boll_upper"]),
                middle=self._round_float(latest["boll_middle"]),
                lower=self._round_float(latest["boll_lower"]),
                closePosition=self._clamp_close_position(latest["boll_position"]),
            ),
            obv=TimingObv(
                value=self._round_float(latest["obv"]),
                slope=self._round_float(latest["obv_slope"]),
            ),
            ema20=self._round_float(latest["ema20"]),
            ema60=self._round_float(latest["ema60"]),
            atr14=self._round_float(latest["atr14"]),
            volumeRatio20=self._round_float(latest["volume_ratio20"]),
        )

        return TimingSignalData(
            stockCode=stock_code,
            stockName=stock_name,
            asOfDate=latest["trade_date"].strftime("%Y-%m-%d"),
            barsCount=len(effective.index),
            indicators=indicators,
            ruleSummary=self.build_rule_summary(enriched),
        )

    def normalize_history(self, history: pd.DataFrame) -> pd.DataFrame:
        if history.empty:
            raise GatewayError(
                code="bars_not_found",
                message="未获取到可用日线数据",
                status_code=404,
                provider="akshare",
            )

        renamed = history.rename(
            columns={
                "日期": "trade_date",
                "开盘": "open",
                "收盘": "close",
                "最高": "high",
                "最低": "low",
                "成交量": "volume",
                "成交额": "amount",
                "换手率": "turnover_rate",
            },
        )

        missing = [
            column
            for column in ["trade_date", "open", "high", "low", "close", "volume"]
            if column not in renamed.columns
        ]
        if missing:
            raise GatewayError(
                code="bars_schema_invalid",
                message=f"日线数据缺少必要字段: {', '.join(missing)}",
                status_code=502,
                provider="akshare",
            )

        frame = renamed.copy()
        frame["trade_date"] = pd.to_datetime(frame["trade_date"]).dt.date
        for column in ["open", "high", "low", "close", "volume", "amount", "turnover_rate"]:
            if column in frame.columns:
                frame[column] = pd.to_numeric(frame[column], errors="coerce")

        frame = frame.dropna(subset=["trade_date", "open", "high", "low", "close", "volume"])
        frame = frame.sort_values("trade_date").reset_index(drop=True)

        if frame.empty:
            raise GatewayError(
                code="bars_not_found",
                message="未获取到可用日线数据",
                status_code=404,
                provider="akshare",
            )

        return frame

    def slice_as_of(
        self,
        history: pd.DataFrame,
        as_of_date: str | None,
    ) -> pd.DataFrame:
        if as_of_date is None:
            return history

        try:
            target_date = datetime.strptime(as_of_date, "%Y-%m-%d").date()
        except ValueError as exc:
            raise GatewayError(
                code="invalid_as_of_date",
                message=f"无效的 asOfDate: {as_of_date}",
                status_code=400,
                provider="gateway",
            ) from exc

        filtered = history[history["trade_date"] <= target_date].reset_index(drop=True)
        if filtered.empty:
            raise GatewayError(
                code="bars_not_found",
                message=f"{as_of_date} 之前没有可用行情数据",
                status_code=404,
                provider="akshare",
            )

        return filtered

    def calculate_indicators(self, history: pd.DataFrame) -> pd.DataFrame:
        frame = history.copy()
        close = frame["close"]
        high = frame["high"]
        low = frame["low"]
        volume = frame["volume"]

        frame["ema20"] = close.ewm(span=20, adjust=False).mean()
        frame["ema60"] = close.ewm(span=60, adjust=False).mean()

        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        frame["macd_dif"] = ema12 - ema26
        frame["macd_dea"] = frame["macd_dif"].ewm(span=9, adjust=False).mean()
        frame["macd_hist"] = (frame["macd_dif"] - frame["macd_dea"]) * 2

        delta = close.diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        average_gain = gain.ewm(alpha=1 / 14, adjust=False).mean()
        average_loss = loss.ewm(alpha=1 / 14, adjust=False).mean()
        rs = average_gain / average_loss.replace(0, float("nan"))
        frame["rsi14"] = (100 - (100 / (1 + rs))).astype(float).fillna(50)

        frame["boll_middle"] = close.rolling(window=20, min_periods=20).mean()
        boll_std = close.rolling(window=20, min_periods=20).std(ddof=0)
        frame["boll_upper"] = frame["boll_middle"] + (boll_std * 2)
        frame["boll_lower"] = frame["boll_middle"] - (boll_std * 2)
        spread = (frame["boll_upper"] - frame["boll_lower"]).replace(0, pd.NA)
        frame["boll_position"] = ((close - frame["boll_lower"]) / spread).fillna(0.5)

        direction = close.diff().fillna(0)
        signed_volume = volume.where(direction >= 0, -volume)
        frame["obv"] = signed_volume.cumsum()
        frame["obv_slope"] = frame["obv"].diff(periods=5).fillna(0)

        previous_close = close.shift(1)
        true_range = pd.concat(
            [
                high - low,
                (high - previous_close).abs(),
                (low - previous_close).abs(),
            ],
            axis=1,
        ).max(axis=1)
        frame["atr14"] = true_range.rolling(window=14, min_periods=14).mean()

        average_volume20 = volume.rolling(window=20, min_periods=20).mean()
        frame["volume_ratio20"] = (volume / average_volume20).fillna(1)

        return frame.ffill().bfill()

    def build_rule_summary(self, history: pd.DataFrame) -> TimingRuleSummary:
        latest = history.iloc[-1]
        positive_score = 0
        negative_score = 0
        warnings: list[str] = []

        if latest["close"] >= latest["ema20"] >= latest["ema60"]:
            positive_score += 2
        elif latest["close"] <= latest["ema20"] <= latest["ema60"]:
            negative_score += 2
        else:
            if latest["close"] > latest["ema20"]:
                positive_score += 1
            elif latest["close"] < latest["ema20"]:
                negative_score += 1

        if latest["macd_hist"] > 0 and latest["macd_dif"] > latest["macd_dea"]:
            positive_score += 2
        elif latest["macd_hist"] < 0 and latest["macd_dif"] < latest["macd_dea"]:
            negative_score += 2

        rsi_value = latest["rsi14"]
        if 52 <= rsi_value <= 68:
            positive_score += 1
        elif 32 <= rsi_value <= 45:
            negative_score += 1

        boll_position = latest["boll_position"]
        if boll_position >= 0.6:
            positive_score += 1
        elif boll_position <= 0.4:
            negative_score += 1

        if latest["volume_ratio20"] >= 1.15:
            positive_score += 1
        elif latest["volume_ratio20"] <= 0.85:
            negative_score += 1

        if latest["obv_slope"] > 0:
            positive_score += 1
        elif latest["obv_slope"] < 0:
            negative_score += 1

        direction_score = positive_score - negative_score
        if direction_score >= 3:
            direction = "bullish"
        elif direction_score <= -3:
            direction = "bearish"
        else:
            direction = "neutral"

        strength_base = min(positive_score + negative_score, 8)
        signal_strength = min(
            100.0,
            round(35 + abs(direction_score) * 15 + strength_base * 3, 2),
        )

        if rsi_value >= 70 or latest["close"] >= latest["boll_upper"]:
            warnings.append("OVERBOUGHT")
        if rsi_value <= 30 or latest["close"] <= latest["boll_lower"]:
            warnings.append("OVERSOLD")

        close_price = max(float(latest["close"]), 0.0001)
        if latest["atr14"] / close_price >= 0.05:
            warnings.append("HIGH_VOLATILITY")

        if latest["close"] < latest["ema20"] or latest["macd_hist"] < 0:
            warnings.append("TREND_WEAKENING")

        return TimingRuleSummary(
            direction=direction,
            signalStrength=signal_strength,
            warnings=list(dict.fromkeys(warnings)),
        )

    def _clamp_close_position(self, value: float) -> float:
        return round(max(0.0, min(1.0, float(value))), 4)

    def _round_float(self, value: float) -> float:
        return round(float(value), 4)


timing_indicators_service = TimingIndicatorsService()
