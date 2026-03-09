"""Standardized timing contracts for daily bars and technical signals."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.contracts.common import BatchItemError
from app.contracts.meta import GatewayResponse


class TimingBar(BaseModel):
    tradeDate: str
    open: float
    high: float
    low: float
    close: float
    volume: float
    amount: float | None = None
    turnoverRate: float | None = None


class TimingBarsData(BaseModel):
    stockCode: str
    stockName: str
    timeframe: str
    adjust: str
    bars: list[TimingBar] = Field(default_factory=list)


class TimingMacd(BaseModel):
    dif: float
    dea: float
    histogram: float


class TimingRsi(BaseModel):
    value: float


class TimingBollinger(BaseModel):
    upper: float
    middle: float
    lower: float
    closePosition: float = Field(..., ge=0, le=1)


class TimingObv(BaseModel):
    value: float
    slope: float


class TimingIndicators(BaseModel):
    close: float
    macd: TimingMacd
    rsi: TimingRsi
    bollinger: TimingBollinger
    obv: TimingObv
    ema20: float
    ema60: float
    atr14: float
    volumeRatio20: float


class TimingRuleSummary(BaseModel):
    direction: str
    signalStrength: float = Field(..., ge=0, le=100)
    warnings: list[str] = Field(default_factory=list)


class TimingSignalData(BaseModel):
    stockCode: str
    stockName: str
    asOfDate: str
    barsCount: int = Field(..., ge=1)
    indicators: TimingIndicators
    ruleSummary: TimingRuleSummary


class TimingSignalBatchData(BaseModel):
    items: list[TimingSignalData] = Field(default_factory=list)
    errors: list[BatchItemError] = Field(default_factory=list)


class TimingSignalBatchRequest(BaseModel):
    stockCodes: list[str] = Field(..., min_length=1, max_length=100)
    asOfDate: str | None = None
    lookbackDays: int | None = Field(default=None, ge=60, le=365)


class TimingMarketIndexSnapshot(BaseModel):
    code: str
    name: str
    close: float
    changePct: float
    ema20: float
    ema60: float
    aboveEma20: bool
    aboveEma60: bool
    atrRatio: float


class TimingMarketBreadthSnapshot(BaseModel):
    totalCount: int = Field(..., ge=0)
    advancingCount: int = Field(..., ge=0)
    decliningCount: int = Field(..., ge=0)
    flatCount: int = Field(..., ge=0)
    positiveRatio: float = Field(..., ge=0, le=1)
    medianChangePct: float
    aboveThreePctCount: int = Field(..., ge=0)
    belowThreePctCount: int = Field(..., ge=0)
    averageTurnoverRate: float | None = None


class TimingMarketVolatilitySnapshot(BaseModel):
    highVolatilityCount: int = Field(..., ge=0)
    highVolatilityRatio: float = Field(..., ge=0, le=1)
    limitDownLikeCount: int = Field(..., ge=0)


class TimingMarketFeatureSnapshot(BaseModel):
    benchmarkStrength: float = Field(..., ge=0, le=100)
    breadthScore: float = Field(..., ge=0, le=100)
    riskScore: float = Field(..., ge=0, le=100)


class TimingMarketRegimeSnapshotData(BaseModel):
    asOfDate: str
    indexes: list[TimingMarketIndexSnapshot] = Field(default_factory=list)
    breadth: TimingMarketBreadthSnapshot
    volatility: TimingMarketVolatilitySnapshot
    features: TimingMarketFeatureSnapshot


class TimingBarsResponse(GatewayResponse[TimingBarsData]):
    pass


class TimingSignalResponse(GatewayResponse[TimingSignalData]):
    pass


class TimingSignalBatchResponse(GatewayResponse[TimingSignalBatchData]):
    pass


class TimingMarketRegimeSnapshotResponse(
    GatewayResponse[TimingMarketRegimeSnapshotData]
):
    pass
