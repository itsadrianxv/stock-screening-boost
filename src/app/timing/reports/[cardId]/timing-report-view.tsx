/* biome-ignore lint/correctness/noUnusedImports: React is required by the current JSX transform in tests. */
import React from "react";
import { EmptyState, Panel, StatusPill } from "~/app/_components/ui";
import { TimingReportChart } from "~/app/timing/reports/[cardId]/timing-report-chart";
import {
  formatTimingActionLabel,
  formatTimingBreadthTrendLabel,
  formatTimingDirectionLabel,
  formatTimingEngineLabel,
  formatTimingMarketStateLabel,
  formatTimingMarketTransitionLabel,
  formatTimingMetricLabel,
  formatTimingMetricValue,
  formatTimingReviewHorizonLabel,
  formatTimingReviewVerdictLabel,
  formatTimingRiskFlagLabel,
  formatTimingVolatilityTrendLabel,
} from "~/app/timing/timing-labels";
import type {
  TimingReportPayload,
  TimingSignalEngineKey,
} from "~/server/domain/timing/types";

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

const marketToneMap: Record<
  string,
  "neutral" | "info" | "success" | "warning"
> = {
  RISK_ON: "success",
  NEUTRAL: "info",
  RISK_OFF: "warning",
};

const evidenceOrder: TimingSignalEngineKey[] = [
  "multiTimeframeAlignment",
  "relativeStrength",
  "volatilityPercentile",
  "liquidityStructure",
  "breakoutFailure",
  "gapVolumeQuality",
];

function formatDate(value?: Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function formatPct(value?: number | null) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${value.toFixed(2)}%`;
}

function SummarySection(props: { report: TimingReportPayload }) {
  const { report } = props;
  const signalContext = report.card.reasoning.signalContext;
  const signalSnapshot = report.card.signalSnapshot;
  const asOfDate = report.card.asOfDate ?? signalSnapshot?.asOfDate ?? "-";

  return (
    <div className="grid gap-6">
      <Panel
        title="褰撳墠缁撹"
        description="鍏堢湅鎽樿銆佽鍔ㄧ悊鐢卞拰鍏抽敭蹇収锛屽啀缁撳悎棣栧睆浠锋牸缁撴瀯鍥惧垽鏂幇鍦ㄨ鎬庝箞鍋氥€?"
        surface="inset"
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill
                label={formatTimingActionLabel(report.card.actionBias)}
                tone={actionToneMap[report.card.actionBias] ?? "neutral"}
              />
              <StatusPill
                label={`缃俊搴?${report.card.confidence}`}
                tone="info"
              />
              <StatusPill label={`鎶ュ憡鏃ユ湡 ${asOfDate}`} />
            </div>
            <p className="max-w-4xl text-base leading-7 text-[var(--app-text)]">
              {report.card.summary}
            </p>
            <p className="max-w-4xl text-sm leading-7 text-[var(--app-text-muted)]">
              {report.card.reasoning.actionRationale}
            </p>
          </div>
          <div className="grid gap-3 rounded-[14px] border border-[var(--app-border-soft)] bg-[var(--app-panel-soft)] p-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <div className="text-xs text-[var(--app-text-soft)]">
                  鏀剁洏浠?
                </div>
                <div className="mt-2 text-2xl text-[var(--app-text)]">
                  {signalSnapshot?.indicators.close.toFixed(2) ?? "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--app-text-soft)]">RSI</div>
                <div className="mt-2 text-2xl text-[var(--app-text)]">
                  {signalSnapshot?.indicators.rsi.value.toFixed(1) ?? "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--app-text-soft)]">
                  閲忔瘮 20D
                </div>
                <div className="mt-2 text-2xl text-[var(--app-text)]">
                  {signalSnapshot?.indicators.volumeRatio20.toFixed(2) ?? "-"}
                </div>
              </div>
            </div>
            <p className="text-sm leading-6 text-[var(--app-text-muted)]">
              {signalContext.summary}
            </p>
          </div>
        </div>
      </Panel>

      <Panel
        title="浠锋牸缁撴瀯"
        description="棣栧睆淇濈暀瀹屾暣浠锋牸缁撴瀯鍥撅紝鐢ㄨ秼鍔裤€佸潎绾夸笌閲忚兘纭褰撳墠浜ゆ槗鑳屾櫙銆?"
      >
        <TimingReportChart
          bars={report.bars}
          chartLevels={report.chartLevels}
        />
      </Panel>
    </div>
  );
}

function EvidenceSection(props: { report: TimingReportPayload }) {
  const { report } = props;

  return (
    <div className="grid gap-6">
      <Panel
        title="缁撴瀯璇佹嵁"
        description="鎷嗗紑浠锋牸缁撴瀯鍜屽叚澶ц瘉鎹紩鎿庯紝鍥炵瓟褰撳墠涓轰粈涔堝亸杩欎釜鏂瑰悜銆?"
      >
        <TimingReportChart
          bars={report.bars}
          chartLevels={report.chartLevels}
        />
      </Panel>

      <Panel title="鍏ぇ璇佹嵁寮曟搸">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {evidenceOrder.map((key) => {
            const evidence = report.evidence[key];

            return (
              <article
                key={evidence.key}
                className="rounded-[14px] border border-[var(--app-border-soft)] bg-[var(--app-panel-soft)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-base font-medium text-[var(--app-text)]">
                    {formatTimingEngineLabel(evidence.key)}
                  </div>
                  <StatusPill
                    label={`${formatTimingDirectionLabel(evidence.direction)} 路 ${evidence.score}`}
                    tone={
                      evidence.direction === "bullish"
                        ? "success"
                        : evidence.direction === "bearish"
                          ? "warning"
                          : "info"
                    }
                  />
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--app-text-muted)]">
                  {evidence.detail}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusPill
                    label={`缃俊搴?${(evidence.confidence * 100).toFixed(0)}%`}
                    tone="info"
                  />
                  <StatusPill
                    label={`鏉冮噸 ${(evidence.weight * 100).toFixed(0)}%`}
                  />
                </div>
                {evidence.warnings.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {evidence.warnings.map((warning) => (
                      <StatusPill
                        key={`${evidence.key}-${warning}`}
                        label={formatTimingRiskFlagLabel(warning)}
                        tone="warning"
                      />
                    ))}
                  </div>
                ) : null}
                <dl className="mt-4 grid gap-2 text-sm text-[var(--app-text-muted)]">
                  {Object.entries(evidence.metrics).map(
                    ([metricKey, value]) => (
                      <div
                        key={`${evidence.key}-${metricKey}`}
                        className="flex items-center justify-between gap-4 rounded-[10px] border border-[var(--app-border-soft)] px-3 py-2"
                      >
                        <dt className="text-[var(--app-text-soft)]">
                          {formatTimingMetricLabel(metricKey)}
                        </dt>
                        <dd className="text-[var(--app-text)]">
                          {formatTimingMetricValue(metricKey, value)}
                        </dd>
                      </div>
                    ),
                  )}
                </dl>
              </article>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function ExecutionSection(props: { report: TimingReportPayload }) {
  const { report } = props;
  const signalContext = report.card.reasoning.signalContext;

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="瑙﹀彂鏉′欢" surface="inset">
          {signalContext.triggerNotes.length > 0 ? (
            <ul className="grid gap-2 text-sm leading-6 text-[var(--app-text-muted)]">
              {signalContext.triggerNotes.map((item) => (
                <li
                  key={item}
                  className="rounded-[12px] border border-[var(--app-border-soft)] bg-[var(--app-panel-soft)] px-3 py-2"
                >
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="鏆傛棤瑙﹀彂鏉′欢" />
          )}
        </Panel>

        <Panel title="澶辨晥鏉′欢" surface="inset">
          {signalContext.invalidationNotes.length > 0 ? (
            <ul className="grid gap-2 text-sm leading-6 text-[var(--app-text-muted)]">
              {signalContext.invalidationNotes.map((item) => (
                <li
                  key={item}
                  className="rounded-[12px] border border-[var(--app-border-soft)] bg-[var(--app-panel-soft)] px-3 py-2"
                >
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="鏆傛棤澶辨晥鏉′欢" />
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Panel title="甯傚満鐜">
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill
                label={formatTimingMarketStateLabel(report.marketContext.state)}
                tone={marketToneMap[report.marketContext.state] ?? "info"}
              />
              <StatusPill
                label={formatTimingMarketTransitionLabel(
                  report.marketContext.transition,
                )}
                tone="info"
              />
              <StatusPill
                label={`鎸佺画 ${report.marketContext.persistenceDays} 澶?`}
              />
              <StatusPill
                label={formatTimingBreadthTrendLabel(
                  report.marketContext.breadthTrend,
                )}
              />
              <StatusPill
                label={formatTimingVolatilityTrendLabel(
                  report.marketContext.volatilityTrend,
                )}
              />
            </div>
            <p className="text-sm leading-7 text-[var(--app-text-muted)]">
              {report.marketContext.summary}
            </p>
            <ul className="grid gap-2 text-sm leading-6 text-[var(--app-text-muted)]">
              {report.marketContext.constraints.map((item) => (
                <li
                  key={item}
                  className="rounded-[12px] border border-[var(--app-border-soft)] bg-[var(--app-panel-soft)] px-3 py-2"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel title="椋庨櫓鏍囩" surface="inset">
          {report.card.riskFlags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {report.card.riskFlags.map((flag) => (
                <StatusPill
                  key={flag}
                  label={formatTimingRiskFlagLabel(flag)}
                  tone="warning"
                />
              ))}
            </div>
          ) : (
            <EmptyState title="鏆傛棤椋庨櫓鏍囩" />
          )}
        </Panel>
      </div>
    </div>
  );
}

function ReviewSection(props: { report: TimingReportPayload }) {
  const { report } = props;

  return (
    <Panel title="澶嶇洏璺熻釜">
      {report.reviewTimeline.length === 0 ? (
        <EmptyState
          title="鏆傛棤宸插畬鎴愬鐩樿褰?"
          description="杩欏彧鑲＄エ鐨勫巻鍙茶瘉鏄庝細鍦ㄥ悗缁鐩樺啓鍥炲悗鍑虹幇鍦ㄨ繖閲屻€?"
        />
      ) : (
        <div className="grid gap-3">
          {report.reviewTimeline.map((item) => (
            <article
              key={item.id}
              className="rounded-[14px] border border-[var(--app-border-soft)] bg-[var(--app-panel-soft)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill
                    label={formatTimingReviewHorizonLabel(item.reviewHorizon)}
                    tone="info"
                  />
                  <StatusPill
                    label={formatTimingActionLabel(item.expectedAction)}
                    tone={actionToneMap[item.expectedAction] ?? "neutral"}
                  />
                  {item.verdict ? (
                    <StatusPill
                      label={formatTimingReviewVerdictLabel(item.verdict)}
                      tone={item.verdict === "SUCCESS" ? "success" : "warning"}
                    />
                  ) : null}
                </div>
                <div className="text-xs text-[var(--app-text-soft)]">
                  {formatDate(item.completedAt ?? item.scheduledAt)}
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div>
                  <div className="text-xs text-[var(--app-text-soft)]">
                    鍖洪棿鏀剁泭
                  </div>
                  <div className="mt-1 text-base text-[var(--app-text)]">
                    {formatPct(item.actualReturnPct)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[var(--app-text-soft)]">
                    鏈€澶ч『琛?
                  </div>
                  <div className="mt-1 text-base text-[var(--app-text)]">
                    {formatPct(item.maxFavorableExcursionPct)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[var(--app-text-soft)]">
                    鏈€澶ч€嗚
                  </div>
                  <div className="mt-1 text-base text-[var(--app-text)]">
                    {formatPct(item.maxAdverseExcursionPct)}
                  </div>
                </div>
              </div>
              {item.reviewSummary ? (
                <p className="mt-3 text-sm leading-6 text-[var(--app-text-muted)]">
                  {item.reviewSummary}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function TimingReportPanels(props: { report: TimingReportPayload }) {
  return (
    <div className="grid gap-6">
      <SummarySection report={props.report} />
      <EvidenceSection report={props.report} />
      <ExecutionSection report={props.report} />
      <ReviewSection report={props.report} />
    </div>
  );
}

export function TimingReportView(props: { report: TimingReportPayload }) {
  return (
    <div className="grid gap-6">
      <TimingReportPanels report={props.report} />
    </div>
  );
}
