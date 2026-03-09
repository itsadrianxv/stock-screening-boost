"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type Tone = "neutral" | "info" | "success" | "warning" | "danger";
type WorkspaceSection =
  | "home"
  | "screening"
  | "workflows"
  | "timing"
  | "companyResearch";

const navItems: Array<{
  key: WorkspaceSection;
  href: string;
  index: string;
  label: string;
  detail: string;
}> = [
  {
    key: "home",
    href: "/",
    index: "01",
    label: "研究总览",
    detail: "桌面与核心入口",
  },
  {
    key: "screening",
    href: "/screening",
    index: "02",
    label: "策略筛选",
    detail: "规则、执行与自选股",
  },
  {
    key: "workflows",
    href: "/workflows",
    index: "03",
    label: "行业研究",
    detail: "问题驱动工作流",
  },
  {
    key: "timing",
    href: "/timing",
    index: "04",
    label: "择时研究",
    detail: "单股信号卡与自选股批量卡",
  },
  {
    key: "companyResearch",
    href: "/company-research",
    index: "05",
    label: "公司研究",
    detail: "概念解析与网页证据",
  },
];

const toneClassMap: Record<Tone, string> = {
  neutral:
    "border-[rgba(130,145,164,0.26)] bg-[rgba(99,112,129,0.12)] text-[var(--app-text-muted)]",
  info: "border-[rgba(102,193,255,0.32)] bg-[rgba(32,74,108,0.22)] text-[var(--app-accent-strong)]",
  success:
    "border-[rgba(110,211,173,0.34)] bg-[rgba(26,68,54,0.24)] text-[var(--app-success)]",
  warning:
    "border-[rgba(226,181,111,0.34)] bg-[rgba(86,60,23,0.24)] text-[var(--app-warning)]",
  danger:
    "border-[rgba(239,142,157,0.34)] bg-[rgba(97,39,50,0.24)] text-[var(--app-danger)]",
};

function DeskMark() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[var(--app-border-strong)] bg-[rgba(16,24,34,0.94)] text-[11px] font-semibold tracking-[0.24em] text-[var(--app-accent-strong)]">
      SSB
    </div>
  );
}

export function WorkspaceShell(props: {
  section: WorkspaceSection;
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
}) {
  const { section, eyebrow, title, description, actions, summary, children } =
    props;

  return (
    <main className="app-shell">
      <div className="mx-auto grid min-h-screen w-full max-w-[1600px] lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="border-b border-[var(--app-border)] bg-[rgba(9,12,16,0.92)] lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-b-0">
          <div className="flex h-full flex-col gap-6 px-4 py-5 sm:px-6 lg:px-5 lg:py-6">
            <div className="flex items-center gap-3">
              <DeskMark />
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--app-text-soft)]">
                  Stock Screening Boost
                </p>
                <p className="app-display mt-1 text-lg leading-none text-[var(--app-text)]">
                  鏆楄壊鎶曠爺妗岄潰
                </p>
              </div>
            </div>

            <nav className="grid gap-1">
              {navItems.map((item) => {
                const active = item.key === section;

                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={cn(
                      "grid grid-cols-[40px_minmax(0,1fr)] items-center gap-3 rounded-[10px] border px-3 py-3 transition-colors",
                      active
                        ? "border-[var(--app-border-strong)] bg-[rgba(18,27,38,0.92)] text-[var(--app-text)]"
                        : "border-transparent text-[var(--app-text-muted)] hover:border-[var(--app-border)] hover:bg-[rgba(17,23,31,0.82)] hover:text-[var(--app-text)]",
                    )}
                  >
                    <span className="app-data text-xs text-[var(--app-text-soft)]">
                      {item.index}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {item.label}
                      </span>
                      <span className="mt-1 block truncate text-xs text-[var(--app-text-soft)]">
                        {item.detail}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto hidden lg:block">
              <div className="rounded-[12px] border border-[var(--app-border)] bg-[rgba(15,20,27,0.88)] p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--app-text-soft)]">
                  Workspace Notes
                </p>
                <p className="mt-3 text-sm leading-6 text-[var(--app-text-muted)]">
                  鍏堢敤缁撴瀯鍖栫瓫閫夌缉灏忔牱鏈紝鍐嶇敤琛屼笟鍜屽叕鍙哥爺绌惰ˉ瓒冲垽鏂紝鏈€鍚庢妸楂樿川閲忔爣鐨勬矇娣€鍒伴暱鏈熻窡韪竻鍗曘€?{" "}
                </p>
              </div>
            </div>
          </div>
        </aside>

        <section className="min-w-0 border-t border-[var(--app-border)] lg:border-t-0 lg:border-l-0">
          <div className="mx-auto flex min-h-screen w-full max-w-[1240px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
            <header className="grid gap-5 border-b border-[var(--app-border)] pb-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.26em] text-[var(--app-text-soft)]">
                  {eyebrow}
                </p>
                <h1 className="app-display mt-2 text-3xl tracking-[-0.03em] text-[var(--app-text)] sm:text-4xl">
                  {title}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--app-text-muted)] sm:text-[15px]">
                  {description}
                </p>
              </div>
              {actions ? (
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  {actions}
                </div>
              ) : null}
            </header>

            {summary ? (
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {summary}
              </section>
            ) : null}

            <div className="grid gap-6">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}

export function Panel(props: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const { title, description, actions, className, children } = props;

  return (
    <section className={cn("app-panel p-5 sm:p-6", className)}>
      {title || description || actions ? (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {title ? (
              <h2 className="app-display text-xl tracking-[-0.02em] text-[var(--app-text)]">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--app-text-muted)]">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}
      <div className={cn(title || description || actions ? "mt-5" : "")}>
        {children}
      </div>
    </section>
  );
}

export function KpiCard(props: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
}) {
  const { label, value, hint, tone = "neutral" } = props;

  return (
    <article className="app-panel-muted rounded-[12px] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-text-soft)]">
          {label}
        </p>
        <span
          className={cn(
            "inline-flex rounded-[8px] border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em]",
            toneClassMap[tone],
          )}
        />
      </div>
      <p className="app-data mt-3 text-2xl text-[var(--app-text)] sm:text-[28px]">
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-xs leading-5 text-[var(--app-text-muted)]">
          {hint}
        </p>
      ) : null}
    </article>
  );
}

export function StatusPill(props: {
  label: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const { label, tone = "neutral", className } = props;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[8px] border px-2.5 py-1 text-[11px] font-medium",
        toneClassMap[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}

export function ProgressBar(props: {
  value: number;
  tone?: Tone;
  className?: string;
}) {
  const { value, tone = "info", className } = props;
  const width = Math.max(0, Math.min(100, value));

  return (
    <div className={cn("app-progress", className)}>
      <div
        className={cn(
          "h-full transition-[width] duration-200",
          tone === "success"
            ? "bg-[linear-gradient(90deg,var(--app-success),#9be7c5)]"
            : tone === "warning"
              ? "bg-[linear-gradient(90deg,var(--app-warning),#f0d9a8)]"
              : tone === "danger"
                ? "bg-[linear-gradient(90deg,var(--app-danger),#f7b0bb)]"
                : "bg-[linear-gradient(90deg,var(--app-accent),#a7e5ff)]",
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function EmptyState(props: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  const { title, description, actions } = props;

  return (
    <div className="rounded-[12px] border border-dashed border-[var(--app-border)] bg-[rgba(14,18,24,0.7)] p-5 text-sm text-[var(--app-text-muted)]">
      <p className="text-[15px] font-medium text-[var(--app-text)]">{title}</p>
      <p className="mt-2 max-w-2xl leading-6">{description}</p>
      {actions ? (
        <div className="mt-4 flex flex-wrap gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function statusTone(status: string | undefined): Tone {
  switch (status) {
    case "SUCCEEDED":
      return "success";
    case "FAILED":
      return "danger";
    case "RUNNING":
      return "info";
    case "PENDING":
      return "warning";
    default:
      return "neutral";
  }
}
