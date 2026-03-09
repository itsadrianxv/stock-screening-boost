import Link from "next/link";

import {
  KpiCard,
  Panel,
  StatusPill,
  WorkspaceShell,
} from "~/app/_components/ui";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";

function formatExecutedAt(executedAt: Date | null): string {
  if (!executedAt) {
    return "尚未执行";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(executedAt);
}

export default async function Home() {
  const session = await auth();
  const signedIn = Boolean(session?.user);

  let strategyCount: number | null = null;
  let watchListCount: number | null = null;
  let recentSessionCount: number | null = null;
  let latestExecutedAt: Date | null = null;
  let loadError: string | null = null;

  if (signedIn) {
    try {
      const [strategies, watchLists, recentSessions] = await Promise.all([
        api.screening.listStrategies({ limit: 100, offset: 0 }),
        api.watchlist.list(),
        api.screening.listRecentSessions({ limit: 10, offset: 0 }),
      ]);

      strategyCount = strategies.length;
      watchListCount = watchLists.length;
      recentSessionCount = recentSessions.length;
      latestExecutedAt = recentSessions[0]?.executedAt ?? null;
    } catch {
      loadError = "数据暂时不可用，请稍后刷新或重新登录。";
    }
  }

  const moduleCards = [
    {
      href: "/screening",
      title: "策略筛选台",
      description: "在一个界面里完成规则编排、异步执行和自选沉淀。",
      tone: "success" as const,
    },
    {
      href: "/workflows",
      title: "行业研究流",
      description: "用问题驱动多 Agent 工作流，把过程和结论完整留痕。",
      tone: "info" as const,
    },
    {
      href: "/company-research",
      title: "公司研究流",
      description: "围绕单一公司拆解概念、问题、网页证据和投资判断。",
      tone: "warning" as const,
    },
    {
      href: signedIn ? "/api/auth/signout" : "/api/auth/signin",
      title: signedIn ? "退出当前账号" : "登录研究空间",
      description: signedIn
        ? "切换账号或暂时退出当前工作区。"
        : "登录后可保存策略、清单和研究记录。",
      tone: signedIn ? ("neutral" as const) : ("warning" as const),
    },
  ];

  return (
    <HydrateClient>
      <WorkspaceShell
        section="home"
        eyebrow="Research Operating System"
        title="投资研究桌面"
        description="把策略筛选、行业研究和公司研究放进同一套暗色工作流里。界面不做花哨展示，只保留真正影响判断效率的结构、状态和动作。"
        actions={
          <>
            <Link href="/screening" className="app-button app-button-success">
              打开策略筛选台
            </Link>
            <Link href="/workflows" className="app-button app-button-primary">
              发起行业研究
            </Link>
            <Link
              href="/company-research"
              className="app-button app-button-primary"
            >
              发起公司研究
            </Link>
            <Link
              href={signedIn ? "/api/auth/signout" : "/api/auth/signin"}
              className="app-button"
            >
              {signedIn ? "退出登录" : "登录"}
            </Link>
          </>
        }
        summary={
          <>
            <KpiCard
              label="策略库"
              value={signedIn ? (strategyCount ?? "-") : "--"}
              hint="可复用的结构化筛选策略"
              tone="success"
            />
            <KpiCard
              label="跟踪清单"
              value={signedIn ? (watchListCount ?? "-") : "--"}
              hint="长期观察与交易计划归档"
              tone="info"
            />
            <KpiCard
              label="近期执行"
              value={signedIn ? (recentSessionCount ?? "-") : "--"}
              hint="最近 10 次筛选执行记录"
              tone="warning"
            />
            <KpiCard
              label="最近更新"
              value={signedIn ? formatExecutedAt(latestExecutedAt) : "--"}
              hint="帮助确认当前工作台是否持续运转"
              tone="neutral"
            />
          </>
        }
      >
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Panel
            title="工作台入口"
            description="四个入口分别负责初筛、行业研究、公司研究和空间管理。路径短、动作明确，保持机构研究桌面的节奏感。"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {moduleCards.map((card) => (
                <Link
                  key={card.title}
                  href={card.href}
                  className="app-panel-muted flex min-h-[192px] flex-col justify-between rounded-[12px] p-4 transition-colors hover:border-[var(--app-border-strong)] hover:bg-[rgba(18,25,34,0.94)]"
                >
                  <div>
                    <StatusPill label={card.title} tone={card.tone} />
                    <p className="app-display mt-4 text-2xl tracking-[-0.02em] text-[var(--app-text)]">
                      {card.title}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[var(--app-text-muted)]">
                      {card.description}
                    </p>
                  </div>
                  <p className="mt-6 text-xs uppercase tracking-[0.2em] text-[var(--app-text-soft)]">
                    Open Module
                  </p>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel
            title="今日节奏"
            description="桌面只保留现在该做的事，避免陷入信息堆积。"
          >
            <div className="space-y-4 text-sm">
              <div className="rounded-[12px] border border-[var(--app-border)] bg-[rgba(13,18,24,0.76)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--app-text-soft)]">
                    研究空间状态
                  </p>
                  <StatusPill
                    label={signedIn ? "已连接" : "未登录"}
                    tone={signedIn ? "success" : "warning"}
                  />
                </div>
                <p className="mt-3 leading-7 text-[var(--app-text-muted)]">
                  {signedIn
                    ? "你已经连接到自己的研究空间，可以继续编辑策略、回看任务和维护跟踪清单。"
                    : "登录后会启用持久化策略、研究记录和自选清单。"}
                </p>
              </div>

              <div className="rounded-[12px] border border-[var(--app-border)] bg-[rgba(13,18,24,0.76)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--app-text-soft)]">
                  推荐顺序
                </p>
                <ol className="mt-3 space-y-3 text-[var(--app-text-muted)]">
                  <li>01. 在策略筛选台确认条件是否覆盖当前风格与市场阶段。</li>
                  <li>
                    02. 用行业研究工作流判断赛道热度、竞争格局和兑现节奏。
                  </li>
                  <li>
                    03.
                    对重点公司发起公司研究，拆出概念兑现、利润贡献和网页证据。
                  </li>
                </ol>
              </div>

              {loadError ? (
                <div className="rounded-[12px] border border-[rgba(226,181,111,0.34)] bg-[rgba(86,60,23,0.2)] p-4 text-[var(--app-warning)]">
                  {loadError}
                </div>
              ) : null}
            </div>
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Panel title="筛选原则">
            <p className="text-sm leading-7 text-[var(--app-text-muted)]">
              先用结构化条件缩小样本，再用评分规则决定优先级。界面强调顺序感，让筛选逻辑一眼可读。
            </p>
          </Panel>
          <Panel title="行业研究原则">
            <p className="text-sm leading-7 text-[var(--app-text-muted)]">
              行业研究不只要结论，也要完整的进度、节点状态和事件时间线，方便追踪每一步输出质量。
            </p>
          </Panel>
          <Panel title="公司研究原则">
            <p className="text-sm leading-7 text-[var(--app-text-muted)]">
              公司研究聚焦概念含金量、利润兑现与投入强度。抓取到的网页证据和待核验缺口同样重要。
            </p>
          </Panel>
        </div>
      </WorkspaceShell>
    </HydrateClient>
  );
}
