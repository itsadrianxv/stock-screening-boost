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
import { COMPANY_RESEARCH_TEMPLATE_CODE } from "~/server/domain/workflow/types";
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

function parseLines(value: string) {
  return value
    .split(/[\n,，、;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeUrlInput(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const statusLabelMap: Record<string, string> = {
  PENDING: "排队中",
  RUNNING: "进行中",
  SUCCEEDED: "已完成",
  FAILED: "失败",
  CANCELLED: "已取消",
};

const starterCases = [
  {
    companyName: "英伟达",
    focusConcepts: "AI 服务器\n数据中心网络\n软件生态",
    keyQuestion: "过去几个季度中，真正能拉动利润率提升的业务环节有哪些？",
  },
  {
    companyName: "特斯拉",
    focusConcepts: "储能\n自动驾驶\n机器人",
    keyQuestion: "去年利润中有多少仍在继续投入到下一轮技术平台？",
  },
  {
    companyName: "药明康德",
    focusConcepts: "ADC\n多肽\n海外产能",
    keyQuestion: "新业务增长是订单先行，还是利润已经开始兑现？",
  },
];

export function CompanyResearchClient() {
  const router = useRouter();
  const utils = api.useUtils();
  const [companyName, setCompanyName] = useState("");
  const [stockCode, setStockCode] = useState("");
  const [officialWebsite, setOfficialWebsite] = useState("");
  const [focusConcepts, setFocusConcepts] = useState("");
  const [keyQuestion, setKeyQuestion] = useState("");
  const [supplementalUrls, setSupplementalUrls] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");

  const runsQuery = api.workflow.listRuns.useQuery({
    limit: 20,
    templateCode: COMPANY_RESEARCH_TEMPLATE_CODE,
  });

  const startMutation = api.workflow.startCompanyResearch.useMutation({
    onSuccess: async (result) => {
      await utils.workflow.listRuns.invalidate({
        limit: 20,
        templateCode: COMPANY_RESEARCH_TEMPLATE_CODE,
      });
      router.push(`/workflows/${result.runId}`);
    },
  });

  const cancelMutation = api.workflow.cancelRun.useMutation({
    onSuccess: async () => {
      await utils.workflow.listRuns.invalidate({
        limit: 20,
        templateCode: COMPANY_RESEARCH_TEMPLATE_CODE,
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
    if (!companyName.trim()) {
      return;
    }

    const normalizedSupplementalUrls = parseLines(supplementalUrls)
      .map(normalizeUrlInput)
      .filter((item): item is string => Boolean(item));

    await startMutation.mutateAsync({
      companyName: companyName.trim(),
      stockCode: stockCode.trim() || undefined,
      officialWebsite: normalizeUrlInput(officialWebsite),
      focusConcepts: parseLines(focusConcepts),
      keyQuestion: keyQuestion.trim() || undefined,
      supplementalUrls: normalizedSupplementalUrls,
      idempotencyKey: idempotencyKey.trim() || undefined,
    });
  };

  return (
    <WorkspaceShell
      section="companyResearch"
      eyebrow="Company Research Workflow"
      title="公司研究任务中心"
      description="用 LangGraph.js 把公司研究拆成概念解析、深问题设计、网页证据抓取和投资判断四个层次。配置 Firecrawl 后，工作流会主动抓官网和公开网页线索；未配置时也会先生成研究框架与待核验问题。"
      actions={
        <>
          <Link href="/" className="app-button">
            返回总览
          </Link>
          <Link href="/workflows" className="app-button app-button-primary">
            打开行业研究
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
            hint="最近 20 条公司研究记录"
            tone="info"
          />
          <KpiCard
            label="进行中"
            value={liveRuns.length}
            hint="排队中与抓取中的任务"
            tone="warning"
          />
          <KpiCard
            label="已完成"
            value={finishedRuns.length}
            hint="已生成概念解析与研究结论"
            tone="success"
          />
          <KpiCard
            label="最近发起"
            value={formatDate(sortedRuns[0]?.createdAt ?? null)}
            hint="用于确认研究台是否持续运转"
            tone="neutral"
          />
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Panel
          title="发起公司研究"
          description="至少填写公司名。官网地址、概念标签和关键问题越具体，后续抓取和概念拆解就越精准。"
          actions={
            <button
              type="button"
              onClick={handleStart}
              disabled={startMutation.isPending || !companyName.trim()}
              className="app-button app-button-primary"
            >
              {startMutation.isPending ? "任务创建中" : "开始研究"}
            </button>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="公司名称，例如：英伟达"
              className="app-input"
            />
            <input
              value={stockCode}
              onChange={(event) => setStockCode(event.target.value)}
              placeholder="股票代码，可选"
              className="app-input"
            />
            <input
              value={officialWebsite}
              onChange={(event) => setOfficialWebsite(event.target.value)}
              placeholder="官网或 IR 地址，可选"
              className="app-input md:col-span-2"
            />
            <textarea
              value={focusConcepts}
              onChange={(event) => setFocusConcepts(event.target.value)}
              placeholder="重点概念，每行或逗号分隔，例如：\nAI 芯片\n数据中心\n软件生态"
              className="app-input min-h-[180px] resize-none"
            />
            <textarea
              value={keyQuestion}
              onChange={(event) => setKeyQuestion(event.target.value)}
              placeholder="你最想先回答的问题，例如：这家公司过去几个季度有多少利润来自某个新业务？"
              className="app-input min-h-[180px] resize-none"
            />
            <textarea
              value={supplementalUrls}
              onChange={(event) => setSupplementalUrls(event.target.value)}
              placeholder="补充网页 URL，可选，每行一个"
              className="app-input min-h-[120px] resize-none md:col-span-2"
            />
            <input
              value={idempotencyKey}
              onChange={(event) => setIdempotencyKey(event.target.value)}
              placeholder="可选：幂等键，用于避免重复创建"
              className="app-input md:col-span-2"
            />
          </div>

          {startMutation.error ? (
            <div className="mt-4 rounded-[10px] border border-[rgba(239,142,157,0.34)] bg-[rgba(97,39,50,0.2)] px-4 py-3 text-sm text-[var(--app-danger)]">
              {startMutation.error.message}
            </div>
          ) : null}
        </Panel>

        <Panel
          title="启动样例"
          description="直接套用一个公司研究场景，然后再改成你自己的标的。"
        >
          <div className="grid gap-3">
            {starterCases.map((item) => (
              <button
                key={item.companyName}
                type="button"
                onClick={() => {
                  setCompanyName(item.companyName);
                  setFocusConcepts(item.focusConcepts);
                  setKeyQuestion(item.keyQuestion);
                }}
                className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(14,19,25,0.84)] px-4 py-4 text-left transition-colors hover:border-[var(--app-border-strong)] hover:bg-[rgba(18,24,32,0.94)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[15px] font-medium text-[var(--app-text)]">
                    {item.companyName}
                  </p>
                  <StatusPill label="概念深挖" tone="info" />
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--app-text-muted)]">
                  {item.keyQuestion}
                </p>
              </button>
            ))}
            <div className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(14,19,25,0.76)] p-4 text-sm leading-6 text-[var(--app-text-muted)]">
              当前工作流会先做概念映射，再生成“利润占比”“投入强度”“兑现节奏”这类深问题，随后用
              Firecrawl 搜索与抓取网页证据，最后输出投资判断。
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        title="最近研究记录"
        description="完成后可以回看概念解析、抓取证据和待核验缺口。"
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
            title="正在加载公司研究记录"
            description="任务列表会在查询完成后显示。"
          />
        ) : sortedRuns.length === 0 ? (
          <EmptyState
            title="还没有公司研究记录"
            description="从上面的表单发起一条任务，系统会自动创建公司研究工作流。"
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
