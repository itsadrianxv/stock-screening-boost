"""Unified gateway for timing bars and daily technical signals."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
import time

from app.contracts.common import BatchItemError
from app.contracts.meta import GatewayWarning
from app.contracts.timing import (
    TimingBar,
    TimingBarsData,
    TimingBarsResponse,
    TimingMarketBreadthSnapshot,
    TimingMarketFeatureSnapshot,
    TimingMarketIndexSnapshot,
    TimingMarketRegimeSnapshotData,
    TimingMarketRegimeSnapshotResponse,
    TimingMarketVolatilitySnapshot,
    TimingSignalBatchData,
    TimingSignalBatchResponse,
    TimingSignalData,
    TimingSignalResponse,
)
from app.gateway.common import build_meta, execute_cached, gateway_cache
from app.policies.cache_policy import get_cache_policy
from app.policies.retry_policy import RetryPolicy
from app.providers.akshare.client import AkShareProviderClient
from app.services.timing_indicators import timing_indicators_service


class TimingGateway:
    def __init__(self, provider_client: AkShareProviderClient | None = None) -> None:
        self._provider_client = provider_client or AkShareProviderClient()
        self._retry_policy = RetryPolicy()
        self._cache = gateway_cache

    def get_bars(
        self,
        *,
        request_id: str,
        stock_code: str,
        start: str | None,
        end: str | None,
        timeframe: str,
        adjust: str,
        force_refresh: bool = False,
    ) -> TimingBarsResponse:
        started_at = time.perf_counter()
        result = execute_cached(
            dataset="timing_bars",
            provider=self._provider_client.provider_name,
            params={
                "stockCode": stock_code,
                "start": start,
                "end": end,
                "timeframe": timeframe,
                "adjust": adjust,
            },
            fetcher=lambda: self._build_bars_data(
                stock_code=stock_code,
                start=start,
                end=end,
                timeframe=timeframe,
                adjust=adjust,
            ),
            cache_policy=get_cache_policy("timing_bars"),
            retry_policy=self._retry_policy,
            cache=self._cache,
            force_refresh=force_refresh,
        )

        return TimingBarsResponse(
            meta=build_meta(
                request_id=request_id,
                provider=result.provider,
                started_at=started_at,
                cache_hit=result.cache_hit,
                is_stale=result.is_stale,
                warnings=result.warnings,
                as_of=result.as_of,
            ),
            data=result.data,
        )

    def get_signal(
        self,
        *,
        request_id: str,
        stock_code: str,
        as_of_date: str | None,
        lookback_days: int | None,
        force_refresh: bool = False,
    ) -> TimingSignalResponse:
        started_at = time.perf_counter()
        result = self._get_signal_result(
            stock_code=stock_code,
            as_of_date=as_of_date,
            lookback_days=lookback_days,
            force_refresh=force_refresh,
        )

        return TimingSignalResponse(
            meta=build_meta(
                request_id=request_id,
                provider=result.provider,
                started_at=started_at,
                cache_hit=result.cache_hit,
                is_stale=result.is_stale,
                warnings=result.warnings,
                as_of=result.as_of,
            ),
            data=result.data,
        )

    def get_signal_batch(
        self,
        *,
        request_id: str,
        stock_codes: list[str],
        as_of_date: str | None,
        lookback_days: int | None,
        force_refresh: bool = False,
    ) -> TimingSignalBatchResponse:
        started_at = time.perf_counter()
        items: list[TimingSignalData] = []
        errors: list[BatchItemError] = []
        warnings: list[GatewayWarning] = []
        cache_hits: list[bool] = []
        stale_hits: list[bool] = []
        as_of_values: list[str] = []

        for stock_code in stock_codes:
            try:
                result = self._get_signal_result(
                    stock_code=stock_code,
                    as_of_date=as_of_date,
                    lookback_days=lookback_days,
                    force_refresh=force_refresh,
                )
                items.append(result.data)
                cache_hits.append(result.cache_hit)
                stale_hits.append(result.is_stale)
                as_of_values.append(result.as_of)
                warnings.extend(result.warnings)
            except Exception as exc:  # noqa: BLE001
                errors.append(
                    BatchItemError(
                        stockCode=stock_code,
                        code=str(getattr(exc, "code", "signal_fetch_failed")),
                        message=str(exc),
                    ),
                )

        if errors:
            warnings.append(
                GatewayWarning(
                    code="partial_results",
                    message="批量择时信号存在部分失败，详情见 data.errors",
                ),
            )

        return TimingSignalBatchResponse(
            meta=build_meta(
                request_id=request_id,
                provider=self._provider_client.provider_name,
                started_at=started_at,
                cache_hit=bool(items) and all(cache_hits),
                is_stale=any(stale_hits),
                warnings=self._dedupe_warnings(warnings),
                as_of=max(as_of_values)
                if as_of_values
                else datetime.now(UTC).isoformat(),
            ),
            data=TimingSignalBatchData(items=items, errors=errors),
        )

    def get_market_regime_snapshot(
        self,
        *,
        request_id: str,
        as_of_date: str | None = None,
        force_refresh: bool = False,
    ) -> TimingMarketRegimeSnapshotResponse:
        started_at = time.perf_counter()
        result = execute_cached(
            dataset="timing_market_regime_snapshot",
            provider=self._provider_client.provider_name,
            params={"asOfDate": as_of_date},
            fetcher=lambda: self._build_market_regime_snapshot(as_of_date=as_of_date),
            cache_policy=get_cache_policy("timing_signal"),
            retry_policy=self._retry_policy,
            cache=self._cache,
            force_refresh=force_refresh,
        )

        return TimingMarketRegimeSnapshotResponse(
            meta=build_meta(
                request_id=request_id,
                provider=result.provider,
                started_at=started_at,
                cache_hit=result.cache_hit,
                is_stale=result.is_stale,
                warnings=result.warnings,
                as_of=result.as_of,
            ),
            data=result.data,
        )

    def _build_bars_data(
        self,
        *,
        stock_code: str,
        start: str | None,
        end: str | None,
        timeframe: str,
        adjust: str,
    ) -> TimingBarsData:
        stock = self._provider_client.get_stock_snapshot(stock_code)
        history = self._provider_client.get_stock_bars(
            stock_code=stock_code,
            start_date=self._resolve_start_date(start=start, end=end, lookback_days=240),
            end_date=end,
            adjust=adjust,
        )

        normalized = timing_indicators_service.normalize_history(history)
        bars = [
            TimingBar(
                tradeDate=row.trade_date.strftime("%Y-%m-%d"),
                open=round(float(row.open), 4),
                high=round(float(row.high), 4),
                low=round(float(row.low), 4),
                close=round(float(row.close), 4),
                volume=round(float(row.volume), 4),
                amount=None if row.amount is None else round(float(row.amount), 4),
                turnoverRate=None
                if row.turnover_rate is None
                else round(float(row.turnover_rate), 4),
            )
            for row in normalized.itertuples(index=False)
        ]

        return TimingBarsData(
            stockCode=stock_code,
            stockName=str(stock.get("name") or stock.get("stockName") or stock_code),
            timeframe=timeframe,
            adjust=adjust,
            bars=bars,
        )

    def _get_signal_result(
        self,
        *,
        stock_code: str,
        as_of_date: str | None,
        lookback_days: int | None,
        force_refresh: bool,
    ):
        effective_lookback = max(
            lookback_days or timing_indicators_service.minimum_lookback_days,
            timing_indicators_service.minimum_lookback_days,
        )

        return execute_cached(
            dataset="timing_signal",
            provider=self._provider_client.provider_name,
            params={
                "stockCode": stock_code,
                "asOfDate": as_of_date,
                "lookbackDays": effective_lookback,
            },
            fetcher=lambda: self._build_signal_data(
                stock_code=stock_code,
                as_of_date=as_of_date,
                lookback_days=effective_lookback,
            ),
            cache_policy=get_cache_policy("timing_signal"),
            retry_policy=self._retry_policy,
            cache=self._cache,
            force_refresh=force_refresh,
        )

    def _build_signal_data(
        self,
        *,
        stock_code: str,
        as_of_date: str | None,
        lookback_days: int,
    ) -> TimingSignalData:
        stock = self._provider_client.get_stock_snapshot(stock_code)
        history = self._provider_client.get_stock_bars(
            stock_code=stock_code,
            start_date=self._resolve_start_date(
                start=None,
                end=as_of_date,
                lookback_days=lookback_days * 2,
            ),
            end_date=as_of_date,
            adjust="qfq",
        )

        return timing_indicators_service.build_signal(
            stock_code=stock_code,
            stock_name=str(stock.get("name") or stock.get("stockName") or stock_code),
            history=history,
            as_of_date=as_of_date,
        )

    def _build_market_regime_snapshot(
        self,
        *,
        as_of_date: str | None,
    ) -> TimingMarketRegimeSnapshotData:
        universe = self._provider_client.get_stock_universe()

        change_values = [
            float(item.get("changePercent") or 0)
            for item in universe
            if item.get("changePercent") is not None
        ]
        turnover_values = [
            float(item.get("turnoverRate") or 0)
            for item in universe
            if item.get("turnoverRate") is not None
        ]

        total_count = len(change_values)
        advancing_count = len([value for value in change_values if value > 0])
        declining_count = len([value for value in change_values if value < 0])
        flat_count = max(total_count - advancing_count - declining_count, 0)
        positive_ratio = (
            round(advancing_count / total_count, 4) if total_count > 0 else 0.0
        )
        above_three_pct_count = len([value for value in change_values if value >= 3])
        below_three_pct_count = len([value for value in change_values if value <= -3])
        high_volatility_count = len([value for value in change_values if abs(value) >= 5])
        high_volatility_ratio = (
            round(high_volatility_count / total_count, 4) if total_count > 0 else 0.0
        )
        limit_down_like_count = len([value for value in change_values if value <= -9])

        index_proxies = [
            ("510300", "CSI 300 ETF"),
            ("510500", "CSI 500 ETF"),
            ("159915", "ChiNext ETF"),
        ]
        indexes: list[TimingMarketIndexSnapshot] = []
        resolved_as_of = as_of_date

        for code, fallback_name in index_proxies:
            signal = self._build_signal_data(
                stock_code=code,
                as_of_date=as_of_date,
                lookback_days=120,
            )
            stock = self._provider_client.get_stock_snapshot(code)
            history = self._provider_client.get_stock_bars(
                stock_code=code,
                start_date=self._resolve_start_date(
                    start=None,
                    end=as_of_date,
                    lookback_days=10,
                ),
                end_date=as_of_date,
                adjust="qfq",
            )
            normalized = timing_indicators_service.normalize_history(history)
            previous_close = float(normalized.iloc[-2]["close"]) if len(normalized) >= 2 else float(normalized.iloc[-1]["close"])
            latest_close = float(normalized.iloc[-1]["close"])
            change_pct = round(((latest_close / previous_close) - 1) * 100, 2) if previous_close else 0.0
            resolved_as_of = signal.asOfDate

            indexes.append(
                TimingMarketIndexSnapshot(
                    code=code,
                    name=str(stock.get("name") or stock.get("stockName") or fallback_name),
                    close=round(signal.indicators.close, 4),
                    changePct=change_pct,
                    ema20=round(signal.indicators.ema20, 4),
                    ema60=round(signal.indicators.ema60, 4),
                    aboveEma20=signal.indicators.close >= signal.indicators.ema20,
                    aboveEma60=signal.indicators.close >= signal.indicators.ema60,
                    atrRatio=round(signal.indicators.atr14 / max(signal.indicators.close, 0.0001), 4),
                )
            )

        trend_points = 0
        total_trend_points = max(len(indexes) * 3, 1)
        for index_item in indexes:
            if index_item.changePct > 0:
                trend_points += 1
            if index_item.aboveEma20:
                trend_points += 1
            if index_item.aboveEma60:
                trend_points += 1

        benchmark_strength = round((trend_points / total_trend_points) * 100, 2)
        breadth_score = round(
            min(
                100,
                max(
                    0,
                    positive_ratio * 70
                    + (above_three_pct_count / max(total_count, 1)) * 30 * 100,
                ),
            ),
            2,
        )
        risk_score = round(
            min(
                100,
                max(
                    0,
                    high_volatility_ratio * 60 * 100
                    + (below_three_pct_count / max(total_count, 1)) * 40 * 100,
                ),
            ),
            2,
        )

        return TimingMarketRegimeSnapshotData(
            asOfDate=resolved_as_of or datetime.now(UTC).strftime("%Y-%m-%d"),
            indexes=indexes,
            breadth=TimingMarketBreadthSnapshot(
                totalCount=total_count,
                advancingCount=advancing_count,
                decliningCount=declining_count,
                flatCount=flat_count,
                positiveRatio=positive_ratio,
                medianChangePct=round(float(sorted(change_values)[len(change_values) // 2]), 2)
                if change_values
                else 0.0,
                aboveThreePctCount=above_three_pct_count,
                belowThreePctCount=below_three_pct_count,
                averageTurnoverRate=round(sum(turnover_values) / len(turnover_values), 2)
                if turnover_values
                else None,
            ),
            volatility=TimingMarketVolatilitySnapshot(
                highVolatilityCount=high_volatility_count,
                highVolatilityRatio=high_volatility_ratio,
                limitDownLikeCount=limit_down_like_count,
            ),
            features=TimingMarketFeatureSnapshot(
                benchmarkStrength=benchmark_strength,
                breadthScore=breadth_score,
                riskScore=risk_score,
            ),
        )

    def _resolve_start_date(
        self,
        *,
        start: str | None,
        end: str | None,
        lookback_days: int,
    ) -> str:
        if start:
            return start.replace("-", "")

        if end:
            base = datetime.strptime(end, "%Y-%m-%d")
        else:
            base = datetime.now(UTC)

        return (base - timedelta(days=lookback_days)).strftime("%Y%m%d")

    def _dedupe_warnings(self, warnings: list[GatewayWarning]) -> list[GatewayWarning]:
        seen: set[tuple[str, str]] = set()
        deduped: list[GatewayWarning] = []

        for warning in warnings:
            key = (warning.code, warning.message)
            if key in seen:
                continue
            seen.add(key)
            deduped.append(warning)

        return deduped


timing_gateway = TimingGateway()
