"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  KpiCard,
  Panel,
  StatusPill,
  WorkspaceShell,
} from "~/app/_components/ui";
import { api } from "~/trpc/react";

function formatDate(value?: Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatPct(value?: number | null) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${value.toFixed(2)}%`;
}

type PortfolioPositionInput = {
  stockCode: string;
  stockName: string;
  quantity: number;
  costBasis: number;
  currentWeightPct: number;
  sector?: string;
  themes?: string[];
};

const actionToneMap: Record<
  string,
  "neutral" | "info" | "success" | "warning"
> = {
  WATCH: "neutral",
  PROBE: "warning",
  ADD: "success",
  HOLD: "info",
  TRIM: "warning",
  EXIT: "warning",
};

const actionLabelMap: Record<string, string> = {
  WATCH: "观察",
  PROBE: "试仓",
  ADD: "加仓",
  HOLD: "持有",
  TRIM: "减仓",
  EXIT: "退出",
};

const sourceLabelMap: Record<string, string> = {
  single: "单股",
  watchlist: "自选股",
  screening: "筛选联动",
};

const marketRegimeToneMap: Record<
  string,
  "neutral" | "info" | "success" | "warning"
> = {
  RISK_ON: "success",
  NEUTRAL: "info",
  RISK_OFF: "warning",
};

export function TimingClient() {
  const router = useRouter();
  const utils = api.useUtils();

  const [stockCode, setStockCode] = useState("");
  const [watchListId, setWatchListId] = useState("");
  const [selectedPortfolioId, setSelectedPortfolioId] = useState("");
  const [portfolioName, setPortfolioName] = useState("核心组合");
  const [baseCurrency, setBaseCurrency] = useState("CNY");
  const [cash, setCash] = useState("30000");
  const [totalCapital, setTotalCapital] = useState("100000");
  const [positionsJson, setPositionsJson] = useState("[]");
  const [maxSingleNamePct, setMaxSingleNamePct] = useState("12");
  const [maxThemeExposurePct, setMaxThemeExposurePct] = useState("28");
  const [defaultProbePct, setDefaultProbePct] = useState("3");
  const [maxPortfolioRiskBudgetPct, setMaxPortfolioRiskBudgetPct] =
    useState("20");
  const [portfolioFormError, setPortfolioFormError] = useState<string | null>(
    null,
  );
  const [filterStockCode, setFilterStockCode] = useState("");
  const [filterSourceType, setFilterSourceType] = useState<
    "all" | "single" | "watchlist" | "screening"
  >("all");

  const watchListsQuery = api.watchlist.list.useQuery({
    limit: 50,
    offset: 0,
    sortBy: "updatedAt",
    sortDirection: "desc",
  });
  const portfolioSnapshotsQuery = api.timing.listPortfolioSnapshots.useQuery();
  const cardsQuery = api.timing.listTimingCards.useQuery({
    limit: 24,
    stockCode: filterStockCode.trim() || undefined,
    sourceType: filterSourceType === "all" ? undefined : filterSourceType,
  });
  const recommendationsQuery = api.timing.listRecommendations.useQuery({
    limit: 48,
    watchListId: watchListId || undefined,
    portfolioSnapshotId: selectedPortfolioId || undefined,
  });

  const startSingleMutation =
    api.workflow.startTimingSignalPipeline.useMutation({
      onSuccess: (result) => {
        router.push(`/workflows/${result.runId}`);
      },
    });
  const startWatchlistCardsMutation =
    api.workflow.startWatchlistTimingCardsPipeline.useMutation({
      onSuccess: (result) => {
        router.push(`/workflows/${result.runId}`);
      },
    });
  const startWatchlistTimingMutation =
    api.workflow.startWatchlistTimingPipeline.useMutation({
      onSuccess: (result) => {
        router.push(`/workflows/${result.runId}`);
      },
    });
  const createPortfolioSnapshotMutation =
    api.timing.createPortfolioSnapshot.useMutation({
      onSuccess: async (snapshot) => {
        setSelectedPortfolioId(snapshot.id);
        await Promise.all([
          utils.timing.listPortfolioSnapshots.invalidate(),
          utils.timing.listRecommendations.invalidate(),
        ]);
      },
    });
  const updatePortfolioSnapshotMutation =
    api.timing.updatePortfolioSnapshot.useMutation({
      onSuccess: async () => {
        await Promise.all([
          utils.timing.listPortfolioSnapshots.invalidate(),
          utils.timing.listRecommendations.invalidate(),
        ]);
      },
    });

  useEffect(() => {
    if (!watchListId && watchListsQuery.data?.[0]?.id) {
      setWatchListId(watchListsQuery.data[0].id);
    }
  }, [watchListId, watchListsQuery.data]);

  useEffect(() => {
    if (!selectedPortfolioId && portfolioSnapshotsQuery.data?.[0]?.id) {
      setSelectedPortfolioId(portfolioSnapshotsQuery.data[0].id);
    }
  }, [portfolioSnapshotsQuery.data, selectedPortfolioId]);

  const cards = cardsQuery.data ?? [];
  const recommendations = recommendationsQuery.data ?? [];
  const latestRecommendationRunId = recommendations[0]?.workflowRunId;
  const latestRecommendations = latestRecommendationRunId
    ? recommendations.filter(
        (item) => item.workflowRunId === latestRecommendationRunId,
      )
    : recommendations;
  const selectedSnapshot =
    portfolioSnapshotsQuery.data?.find(
      (snapshot) => snapshot.id === selectedPortfolioId,
    ) ?? null;
  const recommendationContext = latestRecommendations[0]?.reasoning;

  useEffect(() => {
    if (!selectedSnapshot) {
      return;
    }

    setPortfolioName(selectedSnapshot.name);
    setBaseCurrency(selectedSnapshot.baseCurrency);
    setCash(String(selectedSnapshot.cash));
    setTotalCapital(String(selectedSnapshot.totalCapital));
    setPositionsJson(JSON.stringify(selectedSnapshot.positions, null, 2));
    setMaxSingleNamePct(
      String(selectedSnapshot.riskPreferences.maxSingleNamePct),
    );
    setMaxThemeExposurePct(
      String(selectedSnapshot.riskPreferences.maxThemeExposurePct),
    );
    setDefaultProbePct(
      String(selectedSnapshot.riskPreferences.defaultProbePct),
    );
    setMaxPortfolioRiskBudgetPct(
      String(selectedSnapshot.riskPreferences.maxPortfolioRiskBudgetPct),
    );
    setPortfolioFormError(null);
  }, [selectedSnapshot]);

  const summary = useMemo(() => {
    const addCount = cards.filter((card) => card.actionBias === "ADD").length;
    const probeCount = cards.filter(
      (card) => card.actionBias === "PROBE",
    ).length;
    const distinctStocks = new Set(cards.map((card) => card.stockCode)).size;

    return {
      totalCards: cards.length,
      addCount,
      probeCount,
      distinctStocks,
      latestCreatedAt: cards[0]?.createdAt ?? null,
      recommendationCount: latestRecommendations.length,
      riskBudgetPct: latestRecommendations[0]?.riskBudgetPct ?? null,
    };
  }, [cards, latestRecommendations]);

  const parsePortfolioPayload = () => {
    try {
      const positions = JSON.parse(positionsJson) as PortfolioPositionInput[];
      setPortfolioFormError(null);

      return {
        name: portfolioName.trim(),
        baseCurrency: baseCurrency.trim() || "CNY",
        cash: Number(cash),
        totalCapital: Number(totalCapital),
        positions,
        riskPreferences: {
          maxSingleNamePct: Number(maxSingleNamePct),
          maxThemeExposurePct: Number(maxThemeExposurePct),
          defaultProbePct: Number(defaultProbePct),
          maxPortfolioRiskBudgetPct: Number(maxPortfolioRiskBudgetPct),
        },
      };
    } catch {
      setPortfolioFormError("持仓 JSON 解析失败，请检查格式。");
      return null;
    }
  };

  const handleStartSingle = async () => {
    if (!/^\d{6}$/.test(stockCode.trim())) {
      return;
    }

    await startSingleMutation.mutateAsync({
      stockCode: stockCode.trim(),
    });
  };

  const handleStartWatchlistCards = async () => {
    if (!watchListId) {
      return;
    }

    await startWatchlistCardsMutation.mutateAsync({
      watchListId,
    });
  };

  const handleCreatePortfolioSnapshot = async () => {
    const payload = parsePortfolioPayload();
    if (!payload) {
      return;
    }

    await createPortfolioSnapshotMutation.mutateAsync(payload);
  };

  const handleUpdatePortfolioSnapshot = async () => {
    if (!selectedPortfolioId) {
      return;
    }

    const payload = parsePortfolioPayload();
    if (!payload) {
      return;
    }

    await updatePortfolioSnapshotMutation.mutateAsync({
      id: selectedPortfolioId,
      ...payload,
    });
  };

  const handleStartWatchlistTiming = async () => {
    if (!watchListId || !selectedPortfolioId) {
      return;
    }

    await startWatchlistTimingMutation.mutateAsync({
      watchListId,
      portfolioSnapshotId: selectedPortfolioId,
    });
  };

  return (
    <WorkspaceShell
      section="timing"
      eyebrow="Timing Context"
      title="择时研究台"
      description="阶段二将单股择时卡升级为带组合语境的自选股建议中心：先生成 timing cards，再叠加市场状态、风险预算与组合建议。"
      actions={
        <>
          <Link href="/workflows" className="app-button">
            查看运行记录
          </Link>
          <Link href="/screening" className="app-button app-button-success">
            返回筛选台
          </Link>
        </>
      }
      summary={
        <>
          <KpiCard
            label="已落库卡片"
            value={summary.totalCards}
            hint={`覆盖 ${summary.distinctStocks} 只股票`}
            tone="info"
          />
          <KpiCard
            label="加仓候选"
            value={summary.addCount}
            hint="阶段一卡片中偏向 ADD 的数量"
            tone="success"
          />
          <KpiCard
            label="组合建议"
            value={summary.recommendationCount}
            hint="当前筛选条件下最新一组 recommendations"
            tone="warning"
          />
          <KpiCard
            label="风险预算"
            value={
              summary.riskBudgetPct === null
                ? formatDate(summary.latestCreatedAt)
                : formatPct(summary.riskBudgetPct)
            }
            hint={
              summary.riskBudgetPct === null
                ? "最近卡片写入时间"
                : "阶段二给出的总预算上限"
            }
            tone="neutral"
          />
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel
          title="单股择时卡"
          description="保留阶段一入口，快速生成某只股票的规则化技术信号卡。"
        >
          <div className="grid gap-4">
            <label className="grid gap-2 text-sm text-[var(--app-text-muted)]">
              股票代码
              <input
                value={stockCode}
                onChange={(event) =>
                  setStockCode(
                    event.target.value.replace(/\D/g, "").slice(0, 6),
                  )
                }
                placeholder="例如 600519"
                className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(15,20,27,0.9)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition-colors focus:border-[var(--app-border-strong)]"
              />
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void handleStartSingle()}
                className="app-button app-button-primary"
                disabled={
                  startSingleMutation.isPending || stockCode.length !== 6
                }
              >
                {startSingleMutation.isPending
                  ? "启动中..."
                  : "启动单股 pipeline"}
              </button>
              <span className="text-xs text-[var(--app-text-soft)]">
                输出 `TimingAnalysisCard` 并跳转到 workflow run。
              </span>
            </div>
          </div>
        </Panel>

        <Panel
          title="自选股批量卡"
          description="先跑阶段一批量 cards，适合只看技术面排序、不引入组合语境的场景。"
        >
          <div className="grid gap-4">
            <label className="grid gap-2 text-sm text-[var(--app-text-muted)]">
              Watchlist
              <select
                value={watchListId}
                onChange={(event) => setWatchListId(event.target.value)}
                className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(15,20,27,0.9)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition-colors focus:border-[var(--app-border-strong)]"
              >
                {watchListsQuery.data?.map((watchList) => (
                  <option key={watchList.id} value={watchList.id}>
                    {watchList.name} · {watchList.stockCount} 只
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void handleStartWatchlistCards()}
                className="app-button"
                disabled={startWatchlistCardsMutation.isPending || !watchListId}
              >
                {startWatchlistCardsMutation.isPending
                  ? "启动中..."
                  : "启动批量 cards"}
              </button>
              <span className="text-xs text-[var(--app-text-soft)]">
                适合在进入组合建议前，先看 watchlist 的技术面排序。
              </span>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Panel
          title="组合快照管理"
          description="阶段二输入改为 watchlist + portfolio snapshot。这里维护现金、持仓和风险偏好。"
          actions={
            <>
              <button
                type="button"
                className="app-button"
                onClick={() => void handleCreatePortfolioSnapshot()}
                disabled={createPortfolioSnapshotMutation.isPending}
              >
                {createPortfolioSnapshotMutation.isPending
                  ? "保存中..."
                  : "新建快照"}
              </button>
              <button
                type="button"
                className="app-button app-button-success"
                onClick={() => void handleUpdatePortfolioSnapshot()}
                disabled={
                  updatePortfolioSnapshotMutation.isPending ||
                  !selectedPortfolioId
                }
              >
                {updatePortfolioSnapshotMutation.isPending
                  ? "更新中..."
                  : "更新当前快照"}
              </button>
            </>
          }
        >
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-[220px_1fr_1fr]">
              <label className="grid gap-2 text-sm text-[var(--app-text-muted)]">
                选择快照
                <select
                  value={selectedPortfolioId}
                  onChange={(event) =>
                    setSelectedPortfolioId(event.target.value)
                  }
                  className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(15,20,27,0.9)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition-colors focus:border-[var(--app-border-strong)]"
                >
                  <option value="">新建一个快照</option>
                  {portfolioSnapshotsQuery.data?.map((snapshot) => (
                    <option key={snapshot.id} value={snapshot.id}>
                      {snapshot.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm text-[var(--app-text-muted)]">
                快照名称
                <input
                  value={portfolioName}
                  onChange={(event) => setPortfolioName(event.target.value)}
                  className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(15,20,27,0.9)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition-colors focus:border-[var(--app-border-strong)]"
                />
              </label>
              <label className="grid gap-2 text-sm text-[var(--app-text-muted)]">
                计价货币
                <input
                  value={baseCurrency}
                  onChange={(event) => setBaseCurrency(event.target.value)}
                  className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(15,20,27,0.9)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition-colors focus:border-[var(--app-border-strong)]"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-2 text-sm text-[var(--app-text-muted)]">
                现金
                <input
                  value={cash}
                  onChange={(event) => setCash(event.target.value)}
                  inputMode="decimal"
                  className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(15,20,27,0.9)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition-colors focus:border-[var(--app-border-strong)]"
                />
              </label>
              <label className="grid gap-2 text-sm text-[var(--app-text-muted)]">
                总资本
                <input
                  value={totalCapital}
                  onChange={(event) => setTotalCapital(event.target.value)}
                  inputMode="decimal"
                  className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(15,20,27,0.9)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition-colors focus:border-[var(--app-border-strong)]"
                />
              </label>
              <label className="grid gap-2 text-sm text-[var(--app-text-muted)]">
                最大单票
                <input
                  value={maxSingleNamePct}
                  onChange={(event) => setMaxSingleNamePct(event.target.value)}
                  inputMode="decimal"
                  className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(15,20,27,0.9)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition-colors focus:border-[var(--app-border-strong)]"
                />
              </label>
              <label className="grid gap-2 text-sm text-[var(--app-text-muted)]">
                风险预算上限
                <input
                  value={maxPortfolioRiskBudgetPct}
                  onChange={(event) =>
                    setMaxPortfolioRiskBudgetPct(event.target.value)
                  }
                  inputMode="decimal"
                  className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(15,20,27,0.9)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition-colors focus:border-[var(--app-border-strong)]"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm text-[var(--app-text-muted)]">
                最大主题暴露
                <input
                  value={maxThemeExposurePct}
                  onChange={(event) =>
                    setMaxThemeExposurePct(event.target.value)
                  }
                  inputMode="decimal"
                  className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(15,20,27,0.9)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition-colors focus:border-[var(--app-border-strong)]"
                />
              </label>
              <label className="grid gap-2 text-sm text-[var(--app-text-muted)]">
                默认试仓比例
                <input
                  value={defaultProbePct}
                  onChange={(event) => setDefaultProbePct(event.target.value)}
                  inputMode="decimal"
                  className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(15,20,27,0.9)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition-colors focus:border-[var(--app-border-strong)]"
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm text-[var(--app-text-muted)]">
              持仓 JSON
              <textarea
                value={positionsJson}
                onChange={(event) => setPositionsJson(event.target.value)}
                rows={12}
                className="rounded-[12px] border border-[var(--app-border)] bg-[rgba(10,13,18,0.96)] px-4 py-3 font-mono text-xs leading-6 text-[var(--app-text)] outline-none transition-colors focus:border-[var(--app-border-strong)]"
              />
            </label>

            {portfolioFormError ? (
              <div className="rounded-[10px] border border-[rgba(239,142,157,0.34)] bg-[rgba(97,39,50,0.2)] px-4 py-3 text-sm text-[var(--app-danger)]">
                {portfolioFormError}
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel
          title="阶段二建议 pipeline"
          description="固定顺序是：watchlist cards → market regime → risk plan → portfolio recommendations。"
          actions={
            <button
              type="button"
              onClick={() => void handleStartWatchlistTiming()}
              className="app-button app-button-primary"
              disabled={
                startWatchlistTimingMutation.isPending ||
                !watchListId ||
                !selectedPortfolioId
              }
            >
              {startWatchlistTimingMutation.isPending
                ? "启动中..."
                : "启动建议 pipeline"}
            </button>
          }
        >
          <div className="grid gap-4">
            <div className="grid gap-3 rounded-[12px] border border-[var(--app-border)] bg-[rgba(15,20,27,0.78)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill
                  label={
                    watchListsQuery.data?.find(
                      (item) => item.id === watchListId,
                    )?.name ?? "未选择 watchlist"
                  }
                  tone="info"
                />
                <StatusPill
                  label={selectedSnapshot?.name ?? "未选择组合快照"}
                  tone="neutral"
                />
                <StatusPill
                  label="watchlist_timing_pipeline_v1"
                  tone="success"
                />
              </div>
              <p className="text-sm leading-6 text-[var(--app-text-muted)]">
                阶段二允许在存在组合上下文时给出 HOLD / TRIM /
                EXIT，但仓位区间仍然必须受规则与风险预算共同约束。
              </p>
            </div>

            {latestRecommendations.length > 0 && recommendationContext ? (
              <div className="grid gap-3 rounded-[12px] border border-[var(--app-border)] bg-[rgba(15,20,27,0.78)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill
                    label={latestRecommendations[0]?.marketRegime ?? "NEUTRAL"}
                    tone={
                      marketRegimeToneMap[
                        latestRecommendations[0]?.marketRegime ?? "NEUTRAL"
                      ]
                    }
                  />
                  <StatusPill
                    label={`预算 ${formatPct(latestRecommendations[0]?.riskBudgetPct)}`}
                    tone="warning"
                  />
                  <StatusPill
                    label={`单票上限 ${formatPct(recommendationContext.riskPlan.maxSingleNamePct)}`}
                    tone="neutral"
                  />
                </div>
                <p className="text-sm leading-6 text-[var(--app-text-muted)]">
                  {recommendationContext.marketRegimeSummary}
                </p>
              </div>
            ) : (
              <EmptyState
                title="还没有阶段二建议结果"
                description="先维护一个 PortfolioSnapshot，再启动建议 pipeline。完成后这里会展示市场状态、风险预算和动作排序。"
              />
            )}
          </div>
        </Panel>
      </div>

      <Panel
        title="组合建议表"
        description="所有 recommendations 都来自持久化结果表，不依赖运行态回传。默认展示当前筛选下最新一组建议。"
        actions={
          <button
            type="button"
            onClick={() => void recommendationsQuery.refetch()}
            className="app-button"
          >
            刷新建议
          </button>
        }
      >
        {latestRecommendations.length === 0 ? (
          <EmptyState
            title="暂无 recommendations"
            description="建议 pipeline 成功落库后，这里会按 priority 排序展示 action、建议仓位区间、风险标签和解释。"
          />
        ) : (
          <div className="grid gap-4">
            {latestRecommendations.map((recommendation) => (
              <article
                key={recommendation.id}
                className="rounded-[12px] border border-[var(--app-border)] bg-[rgba(14,18,24,0.88)] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-[var(--app-text)]">
                        {recommendation.stockName}
                      </h3>
                      <span className="text-sm text-[var(--app-text-soft)]">
                        {recommendation.stockCode}
                      </span>
                      <StatusPill
                        label={
                          actionLabelMap[recommendation.action] ??
                          recommendation.action
                        }
                        tone={actionToneMap[recommendation.action] ?? "neutral"}
                      />
                      <StatusPill
                        label={`P${recommendation.priority}`}
                        tone="info"
                      />
                    </div>
                    <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--app-text-muted)]">
                      {recommendation.reasoning.actionRationale}
                    </p>
                  </div>
                  <div className="text-right text-xs text-[var(--app-text-soft)]">
                    <p>写入时间 {formatDate(recommendation.createdAt)}</p>
                    <p>预算上限 {formatPct(recommendation.riskBudgetPct)}</p>
                    {recommendation.workflowRunId ? (
                      <Link
                        href={`/workflows/${recommendation.workflowRunId}`}
                        className="mt-2 inline-flex text-[var(--app-accent-strong)] hover:text-[var(--app-text)]"
                      >
                        查看 run
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(15,20,27,0.78)] px-4 py-3">
                    <div className="text-xs text-[var(--app-text-soft)]">
                      建议区间
                    </div>
                    <div className="mt-2 text-xl text-[var(--app-text)]">
                      {formatPct(recommendation.suggestedMinPct)} -{" "}
                      {formatPct(recommendation.suggestedMaxPct)}
                    </div>
                  </div>
                  <div className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(15,20,27,0.78)] px-4 py-3">
                    <div className="text-xs text-[var(--app-text-soft)]">
                      Confidence
                    </div>
                    <div className="mt-2 text-xl text-[var(--app-text)]">
                      {recommendation.confidence}
                    </div>
                  </div>
                  <div className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(15,20,27,0.78)] px-4 py-3">
                    <div className="text-xs text-[var(--app-text-soft)]">
                      当前持仓
                    </div>
                    <div className="mt-2 text-xl text-[var(--app-text)]">
                      {formatPct(
                        recommendation.reasoning.positionContext
                          .currentWeightPct,
                      )}
                    </div>
                  </div>
                  <div className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(15,20,27,0.78)] px-4 py-3">
                    <div className="text-xs text-[var(--app-text-soft)]">
                      目标增量
                    </div>
                    <div className="mt-2 text-xl text-[var(--app-text)]">
                      {formatPct(
                        recommendation.reasoning.positionContext.targetDeltaPct,
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr_0.9fr]">
                  <div>
                    <p className="text-sm font-medium text-[var(--app-text)]">
                      市场状态约束
                    </p>
                    <ul className="mt-2 grid gap-2 text-sm leading-6 text-[var(--app-text-muted)]">
                      {recommendation.reasoning.regimeConstraints.map(
                        (item) => (
                          <li key={item}>- {item}</li>
                        ),
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--app-text)]">
                      触发与失效
                    </p>
                    <ul className="mt-2 grid gap-2 text-sm leading-6 text-[var(--app-text-muted)]">
                      {recommendation.reasoning.triggerNotes.map((item) => (
                        <li key={item}>- {item}</li>
                      ))}
                      {recommendation.reasoning.invalidationNotes.map(
                        (item) => (
                          <li key={item}>× {item}</li>
                        ),
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--app-text)]">
                      风险标签
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {recommendation.riskFlags.length === 0 ? (
                        <span className="text-sm text-[var(--app-text-soft)]">
                          暂无
                        </span>
                      ) : (
                        recommendation.riskFlags.map((flag) => (
                          <StatusPill key={flag} label={flag} tone="warning" />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="已落库择时卡"
        description="这里保留阶段一结果面板，便于对比 cards 和 recommendations 的差异。"
        actions={
          <button
            type="button"
            onClick={() => void cardsQuery.refetch()}
            className="app-button"
          >
            刷新卡片
          </button>
        }
      >
        <div className="mb-5 grid gap-3 md:grid-cols-[180px_180px_auto]">
          <input
            value={filterStockCode}
            onChange={(event) =>
              setFilterStockCode(
                event.target.value.replace(/\D/g, "").slice(0, 6),
              )
            }
            placeholder="按股票代码筛选"
            className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(15,20,27,0.9)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition-colors focus:border-[var(--app-border-strong)]"
          />
          <select
            value={filterSourceType}
            onChange={(event) =>
              setFilterSourceType(event.target.value as typeof filterSourceType)
            }
            className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(15,20,27,0.9)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition-colors focus:border-[var(--app-border-strong)]"
          >
            <option value="all">全部来源</option>
            <option value="single">单股</option>
            <option value="watchlist">自选股</option>
            <option value="screening">筛选联动</option>
          </select>
          <div className="text-xs leading-6 text-[var(--app-text-soft)]">
            阶段一默认只会产出 WATCH / PROBE / ADD；阶段二建议流程中才允许 HOLD
            / TRIM / EXIT 出现。
          </div>
        </div>

        {cardsQuery.isLoading ? (
          <EmptyState
            title="正在加载择时卡"
            description="持久化结果读取完成后会在这里展示。"
          />
        ) : cards.length === 0 ? (
          <EmptyState
            title="还没有择时卡结果"
            description="先运行单股或 watchlist cards pipeline，完成后这里会自动出现卡片。"
          />
        ) : (
          <div className="grid gap-4">
            {cards.map((card) => {
              const indicators = card.signalSnapshot?.indicators;

              return (
                <article
                  key={card.id}
                  className="rounded-[12px] border border-[var(--app-border)] bg-[rgba(14,18,24,0.88)] p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-[var(--app-text)]">
                          {card.stockName}
                        </h3>
                        <span className="text-sm text-[var(--app-text-soft)]">
                          {card.stockCode}
                        </span>
                        <StatusPill
                          label={
                            actionLabelMap[card.actionBias] ?? card.actionBias
                          }
                          tone={actionToneMap[card.actionBias] ?? "neutral"}
                        />
                        <StatusPill
                          label={
                            sourceLabelMap[card.sourceType] ?? card.sourceType
                          }
                          tone="info"
                        />
                      </div>
                      <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--app-text-muted)]">
                        {card.summary}
                      </p>
                    </div>
                    <div className="text-right text-xs text-[var(--app-text-soft)]">
                      <p>写入时间 {formatDate(card.createdAt)}</p>
                      <p>信号日期 {card.signalSnapshot?.asOfDate ?? "-"}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <div className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(15,20,27,0.78)] px-4 py-3">
                      <div className="text-xs text-[var(--app-text-soft)]">
                        Confidence
                      </div>
                      <div className="mt-2 text-xl text-[var(--app-text)]">
                        {card.confidence}
                      </div>
                    </div>
                    <div className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(15,20,27,0.78)] px-4 py-3">
                      <div className="text-xs text-[var(--app-text-soft)]">
                        RSI
                      </div>
                      <div className="mt-2 text-xl text-[var(--app-text)]">
                        {indicators?.rsi.value.toFixed(1) ?? "-"}
                      </div>
                    </div>
                    <div className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(15,20,27,0.78)] px-4 py-3">
                      <div className="text-xs text-[var(--app-text-soft)]">
                        MACD Hist
                      </div>
                      <div className="mt-2 text-xl text-[var(--app-text)]">
                        {indicators?.macd.histogram.toFixed(2) ?? "-"}
                      </div>
                    </div>
                    <div className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(15,20,27,0.78)] px-4 py-3">
                      <div className="text-xs text-[var(--app-text-soft)]">
                        量比 20D
                      </div>
                      <div className="mt-2 text-xl text-[var(--app-text)]">
                        {indicators?.volumeRatio20.toFixed(2) ?? "-"}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>
    </WorkspaceShell>
  );
}
