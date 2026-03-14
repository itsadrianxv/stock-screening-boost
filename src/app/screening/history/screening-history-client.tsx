"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  KpiCard,
  ProgressBar,
  StatusPill,
  statusTone,
  WorkspaceShell,
} from "~/app/_components/ui";
import {
  formatDate,
  formatDuration,
  isLiveSession,
  parseTopStocks,
  sessionStatusLabelMap,
} from "~/app/screening/screening-ui";
import { api, type RouterOutputs } from "~/trpc/react";

type SessionHistoryItem =
  RouterOutputs["screening"]["listSessionHistory"]["items"][number];

const defaultLimit = 24;

function sessionSummary(session: {
  status: string;
  currentStep?: string | null;
  errorMessage?: string | null;
  matchedCount: number;
}) {
  if (session.errorMessage) {
    return session.errorMessage;
  }

  if (session.currentStep) {
    return session.currentStep;
  }

  if (session.status === "SUCCEEDED") {
    return `命中 ${session.matchedCount} 支股票`;
  }

  return "等待状态更新";
}

export function ScreeningHistoryClient() {
  const utils = api.useUtils();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [limit, setLimit] = useState(defaultLimit);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );

  const sessionsQuery = api.screening.listSessionHistory.useQuery(
    {
      limit,
      offset: 0,
      search: deferredSearch || undefined,
    },
    { refetchOnWindowFocus: false },
  );

  const sessions = sessionsQuery.data?.items ?? [];
  const totalCount = sessionsQuery.data?.totalCount ?? 0;
  const liveCount = useMemo(() => {
    return sessions.filter((session) => isLiveSession(session.status)).length;
  }, [sessions]);
  const finishedCount = useMemo(() => {
    return sessions.filter((session) => session.status === "SUCCEEDED").length;
  }, [sessions]);

  useEffect(() => {
    if (sessions.length === 0) {
      setSelectedSessionId(null);
      return;
    }

    if (
      !selectedSessionId ||
      !sessions.some((session) => session.id === selectedSessionId)
    ) {
      setSelectedSessionId(sessions[0]?.id ?? null);
    }
  }, [sessions, selectedSessionId]);

  const sessionDetailQuery = api.screening.getSessionDetail.useQuery(
    { sessionId: selectedSessionId ?? "" },
    {
      enabled: Boolean(selectedSessionId),
      refetchOnWindowFocus: false,
      refetchInterval: (query) =>
        isLiveSession(query.state.data?.status) ? 3_000 : false,
    },
  );

  const cancelSessionMutation = api.screening.cancelSession.useMutation({
    onSuccess: async (result) => {
      await Promise.all([
        utils.screening.listSessionHistory.invalidate(),
        utils.screening.listRecentSessions.invalidate(),
        utils.screening.getSessionDetail.invalidate({
          sessionId: result.sessionId,
        }),
      ]);
    },
  });

  const retrySessionMutation = api.screening.retrySession.useMutation({
    onSuccess: async (result) => {
      setSelectedSessionId(result.sessionId);
      await Promise.all([
        utils.screening.listSessionHistory.invalidate(),
        utils.screening.listRecentSessions.invalidate(),
        utils.screening.getSessionDetail.invalidate({
          sessionId: result.sessionId,
        }),
      ]);
    },
  });

  const deleteSessionMutation = api.screening.deleteSession.useMutation({
    onSuccess: async (_, variables) => {
      if (variables.id === selectedSessionId) {
        setSelectedSessionId(null);
      }

      await Promise.all([
        utils.screening.listSessionHistory.invalidate(),
        utils.screening.listRecentSessions.invalidate(),
        utils.screening.getSessionDetail.invalidate(),
      ]);
    },
  });

  const parsedTopStocks = useMemo(() => {
    return parseTopStocks(sessionDetailQuery.data?.topStocks);
  }, [sessionDetailQuery.data?.topStocks]);

  return (
    <WorkspaceShell
      section="screening"
      eyebrow="机会池历史"
      title="历史会话库"
      description="像浏览资料库一样回看每次筛选会话，支持按策略名、步骤、报错和命中内容做模糊搜索。"
      actions={
        <>
          <Link href="/screening" className="app-button">
            返回机会池
          </Link>
          <Link
            href="/timing/history"
            className="app-button app-button-primary"
          >
            择时历史
          </Link>
        </>
      }
      summary={
        <>
          <KpiCard label="历史总数" value={totalCount} tone="info" />
          <KpiCard label="当前载入" value={sessions.length} tone="neutral" />
          <KpiCard label="进行中" value={liveCount} tone="warning" />
          <KpiCard label="已完成" value={finishedCount} tone="success" />
        </>
      }
    >
      <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="app-panel p-4 sm:p-5">
          <div className="border-b border-[var(--app-border)] pb-4">
            <label className="grid gap-2 text-sm text-[var(--app-text-muted)]">
              搜索历史会话
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setLimit(defaultLimit);
                }}
                placeholder="搜索策略名、步骤、报错、股票代码或命中内容"
                className="app-input"
              />
            </label>
            <p className="mt-3 text-xs leading-5 text-[var(--app-text-soft)]">
              左侧按时间浏览，右侧直接查看命中结果、执行状态和关键明细。
            </p>
          </div>

          <div className="mt-4 grid gap-3">
            {sessionsQuery.isLoading ? (
              <EmptyState title="正在加载会话历史" />
            ) : sessions.length === 0 ? (
              <EmptyState title="还没有匹配的历史会话" />
            ) : (
              sessions.map((session: SessionHistoryItem) => {
                const active = session.id === selectedSessionId;

                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setSelectedSessionId(session.id)}
                    className={`rounded-[16px] border px-4 py-4 text-left transition-colors ${
                      active
                        ? "border-[var(--app-border-strong)] bg-[rgba(18,28,39,0.96)]"
                        : "border-[var(--app-border)] bg-[rgba(12,16,22,0.82)] hover:border-[var(--app-border-strong)] hover:bg-[rgba(16,21,29,0.9)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill
                        label={
                          sessionStatusLabelMap[session.status] ??
                          session.status
                        }
                        tone={statusTone(session.status)}
                      />
                      <StatusPill
                        label={`${session.matchedCount} 命中`}
                        tone={session.matchedCount > 0 ? "success" : "neutral"}
                      />
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm font-medium leading-6 text-[var(--app-text)]">
                      {session.strategyName}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--app-text-muted)]">
                      {sessionSummary(session)}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--app-text-soft)]">
                      <span>{formatDate(session.executedAt)}</span>
                      <span>{session.progressPercent}%</span>
                    </div>
                    {isLiveSession(session.status) ? (
                      <div className="mt-3">
                        <ProgressBar
                          value={session.progressPercent}
                          tone={statusTone(session.status)}
                        />
                      </div>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          {sessions.length < totalCount ? (
            <button
              type="button"
              onClick={() => setLimit((current) => current + defaultLimit)}
              disabled={sessionsQuery.isFetching}
              className="app-button mt-4 w-full"
            >
              {sessionsQuery.isFetching ? "加载中..." : "加载更多"}
            </button>
          ) : null}
        </aside>

        <section className="app-panel p-4 sm:p-6">
          {!selectedSessionId ? (
            <EmptyState
              title="选择一条会话查看详情"
              description="历史页会保留每次筛选的执行情况、命中数量和结果摘要。"
            />
          ) : sessionDetailQuery.isLoading ? (
            <EmptyState title="正在加载会话详情" />
          ) : sessionDetailQuery.error ? (
            <EmptyState
              title="暂时无法读取这条会话"
              description={sessionDetailQuery.error.message}
            />
          ) : !sessionDetailQuery.data ? (
            <EmptyState title="未找到这条会话" />
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--app-border)] pb-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill
                      label={
                        sessionStatusLabelMap[sessionDetailQuery.data.status] ??
                        sessionDetailQuery.data.status
                      }
                      tone={statusTone(sessionDetailQuery.data.status)}
                    />
                    <StatusPill
                      label={`${sessionDetailQuery.data.matchedCount} 支命中`}
                      tone={
                        sessionDetailQuery.data.matchedCount > 0
                          ? "success"
                          : "neutral"
                      }
                    />
                    <StatusPill
                      label={`${sessionDetailQuery.data.totalScanned} 支扫描`}
                      tone="info"
                    />
                  </div>
                  <h2 className="mt-4 text-2xl font-medium tracking-[-0.02em] text-[var(--app-text)]">
                    {sessionDetailQuery.data.strategyName}
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--app-text-muted)]">
                    {sessionSummary({
                      status: sessionDetailQuery.data.status,
                      currentStep: sessionDetailQuery.data.currentStep,
                      errorMessage: sessionDetailQuery.data.errorMessage,
                      matchedCount: sessionDetailQuery.data.matchedCount,
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isLiveSession(sessionDetailQuery.data.status) ? (
                    <button
                      type="button"
                      onClick={() =>
                        cancelSessionMutation.mutate({
                          sessionId: sessionDetailQuery.data.id,
                        })
                      }
                      disabled={cancelSessionMutation.isPending}
                      className="app-button app-button-danger"
                    >
                      {cancelSessionMutation.isPending
                        ? "取消中..."
                        : "取消会话"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        retrySessionMutation.mutate({
                          sessionId: sessionDetailQuery.data.id,
                        })
                      }
                      disabled={retrySessionMutation.isPending}
                      className="app-button app-button-primary"
                    >
                      {retrySessionMutation.isPending
                        ? "重试中..."
                        : "重新执行"}
                    </button>
                  )}
                  {!isLiveSession(sessionDetailQuery.data.status) ? (
                    <button
                      type="button"
                      onClick={() =>
                        deleteSessionMutation.mutate({
                          id: sessionDetailQuery.data.id,
                        })
                      }
                      disabled={deleteSessionMutation.isPending}
                      className="app-button"
                    >
                      {deleteSessionMutation.isPending
                        ? "删除中..."
                        : "删除会话"}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[14px] border border-[var(--app-border)] bg-[rgba(12,16,22,0.82)] px-4 py-4">
                  <p className="text-xs text-[var(--app-text-soft)]">
                    执行时间
                  </p>
                  <p className="mt-2 text-sm font-medium text-[var(--app-text)]">
                    {formatDate(sessionDetailQuery.data.executedAt)}
                  </p>
                </div>
                <div className="rounded-[14px] border border-[var(--app-border)] bg-[rgba(12,16,22,0.82)] px-4 py-4">
                  <p className="text-xs text-[var(--app-text-soft)]">
                    执行耗时
                  </p>
                  <p className="mt-2 text-sm font-medium text-[var(--app-text)]">
                    {formatDuration(sessionDetailQuery.data.executionTime)}
                  </p>
                </div>
                <div className="rounded-[14px] border border-[var(--app-border)] bg-[rgba(12,16,22,0.82)] px-4 py-4">
                  <p className="text-xs text-[var(--app-text-soft)]">
                    当前步骤
                  </p>
                  <p className="mt-2 text-sm font-medium text-[var(--app-text)]">
                    {sessionDetailQuery.data.currentStep ?? "等待执行"}
                  </p>
                </div>
                <div className="rounded-[14px] border border-[var(--app-border)] bg-[rgba(12,16,22,0.82)] px-4 py-4">
                  <p className="text-xs text-[var(--app-text-soft)]">
                    剩余候选
                  </p>
                  <p className="mt-2 text-sm font-medium text-[var(--app-text)]">
                    {sessionDetailQuery.data.otherStockCodes.length}
                  </p>
                </div>
              </div>

              {isLiveSession(sessionDetailQuery.data.status) ? (
                <div className="mt-5 rounded-[16px] border border-[var(--app-border)] bg-[rgba(12,16,22,0.82)] p-4">
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs text-[var(--app-text-soft)]">
                    <span>
                      {sessionDetailQuery.data.currentStep ?? "等待更新"}
                    </span>
                    <span>{sessionDetailQuery.data.progressPercent}%</span>
                  </div>
                  <ProgressBar
                    value={sessionDetailQuery.data.progressPercent}
                    tone={statusTone(sessionDetailQuery.data.status)}
                  />
                </div>
              ) : null}

              {sessionDetailQuery.data.errorMessage ? (
                <div className="mt-5 rounded-[16px] border border-[rgba(201,119,132,0.34)] bg-[rgba(81,33,43,0.22)] px-4 py-3 text-sm text-[var(--app-danger)]">
                  {sessionDetailQuery.data.errorMessage}
                </div>
              ) : null}

              <div className="mt-5 rounded-[18px] border border-[var(--app-border)] bg-[rgba(12,16,22,0.82)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-medium text-[var(--app-text)]">
                      命中股票
                    </h3>
                    <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                      当前会话命中的核心候选会保留在这里，方便对照每次筛选结果。
                    </p>
                  </div>
                  <StatusPill
                    label={`${parsedTopStocks.length} 条结果`}
                    tone={parsedTopStocks.length > 0 ? "success" : "neutral"}
                  />
                </div>

                {parsedTopStocks.length === 0 ? (
                  <EmptyState
                    title="这次会话还没有最终命中结果"
                    description="如果会话仍在执行中，结果会在完成后自动刷新。"
                  />
                ) : (
                  <div className="mt-4 overflow-auto rounded-[14px] border border-[var(--app-border)]">
                    <table className="app-table min-w-[820px]">
                      <thead>
                        <tr>
                          <th>股票</th>
                          <th>评分</th>
                          <th>指标摘要</th>
                          <th>命中原因</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedTopStocks.slice(0, 16).map((stock) => (
                          <tr key={stock.stockCode}>
                            <td>
                              <div className="flex flex-col">
                                <span className="font-medium text-[var(--app-text)]">
                                  {stock.stockName}
                                </span>
                                <span className="text-xs text-[var(--app-text-soft)]">
                                  {stock.stockCode}
                                </span>
                              </div>
                            </td>
                            <td className="text-[var(--app-success)]">
                              {stock.score.toFixed(4)}
                            </td>
                            <td className="text-sm text-[var(--app-text-muted)]">
                              {stock.indicatorPreview}
                            </td>
                            <td className="text-sm text-[var(--app-text-muted)]">
                              {stock.explanations[0] ?? "暂无说明"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </section>
    </WorkspaceShell>
  );
}
