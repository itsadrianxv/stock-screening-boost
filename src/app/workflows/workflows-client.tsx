"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  EmptyState,
  KpiCard,
  Panel,
  ProgressBar,
  StatusPill,
  statusTone,
  WorkspaceShell,
} from "~/app/_components/ui";
import { QUICK_RESEARCH_TEMPLATE_CODE } from "~/server/domain/workflow/types";
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

const statusLabelMap: Record<string, string> = {
  PENDING: "排队中",
  RUNNING: "进行中",
  SUCCEEDED: "已完成",
  FAILED: "失败",
  CANCELLED: "已取消",
};

const quickPrompts = [
  "半导体设备国产替代，未来 12 个月核心机会与风险是什么？",
  "创新药出海链条中，最值得跟踪的商业化指标有哪些？",
  "AI 算力基础设施的盈利兑现节奏应如何判断？",
];

export function WorkflowsClient() {
  const router = useRouter();
  const utils = api.useUtils();
  const [query, setQuery] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");

  const runsQuery = api.workflow.listRuns.useQuery({
    limit: 20,
    templateCode: QUICK_RESEARCH_TEMPLATE_CODE,
  });

  const startMutation = api.workflow.startQuickResearch.useMutation({
    onSuccess: async (result) => {
      await utils.workflow.listRuns.invalidate({
        limit: 20,
        templateCode: QUICK_RESEARCH_TEMPLATE_CODE,
      });
      router.push(`/workflows/${result.runId}`);
    },
  });

  const cancelMutation = api.workflow.cancelRun.useMutation({
    onSuccess: async () => {
      await utils.workflow.listRuns.invalidate({
        limit: 20,
        templateCode: QUICK_RESEARCH_TEMPLATE_CODE,
      });
    },
  });

  const sortedRuns = useMemo(() => {
    return [...(runsQuery.data?.items ?? [])].sort((left, right) => {
      return (
        (right.createdAt?.getTime?.() ?? 0) - (left.createdAt?.getTime?.() ?? 0)
      );
    });
  }, [runsQuery.data?.items]);

  const liveRuns = sortedRuns.filter(
    (run) => run.status === "PENDING" || run.status === "RUNNING",
  );
  const finishedRuns = sortedRuns.filter((run) => run.status === "SUCCEEDED");

  const handleStart = async () => {
    if (!query.trim()) {
      return;
    }

    await startMutation.mutateAsync({
      query: query.trim(),
      idempotencyKey: idempotencyKey.trim() || undefined,
    });
  };

  return (
    <WorkspaceShell
      section="workflows"
      eyebrow="Industry Research Workflow"
      title="行业研究任务中心"
      description="围绕一个清晰问题启动行业研究工作流，持续追踪节点状态、事件时间线和结构化结论。这里更像任务台，而不是展示页。"
      actions={
        <>
          <Link href="/" className="app-button">
            返回总览
          </Link>
          <Link
            href="/company-research"
            className="app-button app-button-primary"
          >
            打开公司研究
          </Link>
          <Link href="/screening" className="app-button app-button-success">
            去策略筛选台
          </Link>
        </>
      }
      summary={
        <>
          <KpiCard
            label="任务总数"
            value={sortedRuns.length}
            hint="最近 20 条行业研究记录"
            tone="info"
          />
          <KpiCard
            label="进行中"
            value={liveRuns.length}
            hint="排队中与执行中的任务"
            tone="warning"
          />
          <KpiCard
            label="已完成"
            value={finishedRuns.length}
            hint="成功返回结果的任务"
            tone="success"
          />
          <KpiCard
            label="最近发起"
            value={formatDate(sortedRuns[0]?.createdAt ?? null)}
            hint="用于确认研究流是否在持续运转"
            tone="neutral"
          />
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel
          title="发起研究"
          description="建议按“行业 / 链条 / 主题 + 关键问题”的格式提问，让工作流更快产出可执行结论。"
          actions={
            <button
              type="button"
              onClick={handleStart}
              disabled={startMutation.isPending || !query.trim()}
              className="app-button app-button-primary"
            >
              {startMutation.isPending ? "任务创建中" : "开始研究"}
            </button>
          }
        >
          <div className="grid gap-4">
            <textarea
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="请输入你想研究的行业问题，例如：AI 眼镜供应链中，哪些环节会先兑现利润？"
              className="app-input min-h-[180px] resize-none"
            />
            <input
              value={idempotencyKey}
              onChange={(event) => setIdempotencyKey(event.target.value)}
              placeholder="可选：幂等键，用于避免重复创建"
              className="app-input"
            />
            {startMutation.error ? (
              <div className="rounded-[10px] border border-[rgba(239,142,157,0.34)] bg-[rgba(97,39,50,0.2)] px-4 py-3 text-sm text-[var(--app-danger)]">
                {startMutation.error.message}
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel
          title="问题模板"
          description="先用成熟提问方式铺开结构，再补充你最关心的判断维度。"
        >
          <div className="grid gap-3">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setQuery(prompt)}
                className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(14,19,25,0.84)] px-4 py-3 text-left text-sm leading-6 text-[var(--app-text-muted)] transition-colors hover:border-[var(--app-border-strong)] hover:bg-[rgba(18,24,32,0.94)] hover:text-[var(--app-text)]"
              >
                {prompt}
              </button>
            ))}
            <div className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(14,19,25,0.76)] p-4 text-sm leading-6 text-[var(--app-text-muted)]">
              好问题应该同时包含范围、变量和验证口径，例如“盈利兑现节奏如何判断”比“怎么看这个行业”更适合作为工作流输入。
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        title="最近研究记录"
        description="状态、进度和详情入口放在同一列表里，适合高频查看与快速取消。"
        actions={
          <button
            type="button"
            onClick={() => runsQuery.refetch()}
            className="app-button"
          >
            刷新列表
          </button>
        }
      >
        {runsQuery.isLoading ? (
          <EmptyState
            title="正在加载研究记录"
            description="任务列表会在查询完成后显示。"
          />
        ) : sortedRuns.length === 0 ? (
          <EmptyState
            title="还没有研究记录"
            description="从上面的提问台发起一个问题，系统会自动创建新的行业研究任务。"
          />
        ) : (
          <div className="grid gap-3">
            {sortedRuns.map((run) => (
              <article
                key={run.id}
                className="rounded-[12px] border border-[var(--app-border)] bg-[rgba(13,18,25,0.74)] p-4"
              >
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_140px_150px_auto] xl:items-start">
                  <div className="min-w-0">
                    <p className="text-base font-medium text-[var(--app-text)]">
                      {run.query}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusPill
                        label={statusLabelMap[run.status] ?? run.status}
                        tone={statusTone(run.status)}
                      />
                      <span className="text-xs text-[var(--app-text-soft)]">
                        创建于 {formatDate(run.createdAt)}
                      </span>
                    </div>
                    <p className="app-data mt-3 break-all text-[11px] text-[var(--app-text-soft)]">
                      {run.id}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-text-soft)]">
                      进度
                    </p>
                    <p className="app-data mt-2 text-lg text-[var(--app-text)]">
                      {run.progressPercent}%
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-text-soft)]">
                      状态条
                    </p>
                    <ProgressBar
                      value={run.progressPercent}
                      tone={statusTone(run.status)}
                      className="mt-3"
                    />
                  </div>

                  <div className="flex flex-wrap items-start justify-end gap-2">
                    <Link
                      href={`/workflows/${run.id}`}
                      className="app-button app-button-primary"
                    >
                      查看详情
                    </Link>
                    {(run.status === "PENDING" || run.status === "RUNNING") && (
                      <button
                        type="button"
                        onClick={() => cancelMutation.mutate({ runId: run.id })}
                        className="app-button app-button-danger"
                      >
                        取消任务
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {runsQuery.error ? (
          <div className="mt-4 rounded-[10px] border border-[rgba(239,142,157,0.34)] bg-[rgba(97,39,50,0.2)] px-4 py-3 text-sm text-[var(--app-danger)]">
            {runsQuery.error.message}
          </div>
        ) : null}
      </Panel>
    </WorkspaceShell>
  );
}
