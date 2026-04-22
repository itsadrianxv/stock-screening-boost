"use client";

import Link from "next/link";
/* biome-ignore lint/correctness/noUnusedImports: React is required for server-side JSX rendering in tests. */
import React, { useMemo, useState } from "react";

import { MarkdownContent } from "~/app/_components/markdown-content";
import {
  EmptyState,
  KeyPointList,
  Panel,
  StatusPill,
  type Tone,
} from "~/app/_components/ui";
import {
  formatRuntimeIssueLabel,
  formatSourceTierLabel,
  formatSourceTypeLabel,
  formatWorkflowNodeLabel,
} from "~/app/workflows/detail-labels";
import {
  buildResearchDigest,
  extractConfidenceAnalysis,
  isCompanyResearchResult,
  type ResearchDigest,
} from "~/app/workflows/research-view-models";
import type { ConfidenceAnalysis } from "~/server/domain/intelligence/confidence";
import {
  COMPANY_RESEARCH_TEMPLATE_CODE,
  type CompanyResearchReferenceItem,
  type CompanyResearchResultDto,
} from "~/server/domain/workflow/types";

type CompanyResearchBackgroundItem = {
  label: string;
  value: string;
};

type CompanyResearchConceptCard = {
  id: string;
  concept: string;
  whyItMatters: string;
  companyFit: string;
  monetizationPath: string;
  maturity: string;
};

type CompanyResearchQuestionCard = {
  id: string;
  question: string;
  whyImportant: string;
  targetMetric: string;
  dataHint: string;
  answer: string;
  confidence: "high" | "medium" | "low";
  referenceCount: number;
  gapCount: number;
  gaps: string[];
  referencePreview: CompanyResearchReferenceItem[];
};

type CompanyResearchReferenceFilter = {
  id: string;
  label: string;
  count: number;
};

type CompanyResearchDetailModel = {
  kind: "detail";
  backgroundItems: CompanyResearchBackgroundItem[];
  digest: ResearchDigest;
  confidenceSummary: {
    score: string;
    level: string;
    coverage: string;
    notes: string[];
  };
  conceptCards: CompanyResearchConceptCard[];
  questionCards: CompanyResearchQuestionCard[];
  referenceFilters: CompanyResearchReferenceFilter[];
  collectors: CompanyResearchResultDto["collectionSummary"]["collectors"];
  references: CompanyResearchReferenceItem[];
  referenceStats: Array<{
    label: string;
    value: string;
  }>;
};

type CompanyResearchPausedFallbackModel = {
  kind: "paused_fallback";
  backgroundItems: CompanyResearchBackgroundItem[];
  blockers: string[];
  nextActions: string[];
};

export type CompanyResearchDetailPageModel =
  | CompanyResearchDetailModel
  | CompanyResearchPausedFallbackModel;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueList(items: Array<string | undefined>, limit = 6) {
  return [
    ...new Set(items.map((item) => item?.trim()).filter(Boolean) as string[]),
  ].slice(0, limit);
}

function formatDate(value?: Date | string | null) {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatStatusLabel(status?: string) {
  switch (status) {
    case "PENDING":
      return "鎺掗槦涓?";
    case "RUNNING":
      return "杩涜涓?";
    case "PAUSED":
      return "宸叉殏鍋?";
    case "SUCCEEDED":
      return "宸插畬鎴?";
    case "FAILED":
      return "澶辫触";
    case "CANCELLED":
      return "宸插彇娑?";
    default:
      return "鏈煡";
  }
}

function formatConfidenceLevel(level?: string) {
  switch (level) {
    case "high":
      return "楂?";
    case "medium":
      return "涓?";
    case "low":
      return "浣?";
    default:
      return "鏈煡";
  }
}

function confidenceTone(level?: string): Tone {
  switch (level) {
    case "high":
      return "success";
    case "medium":
      return "info";
    case "low":
      return "warning";
    default:
      return "neutral";
  }
}

function buildBackgroundItemsFromBrief(params: {
  companyName?: string;
  stockCode?: string;
  researchGoal?: string;
  focusConcepts?: string[];
  status?: string;
  generatedAt?: Date | string | null;
}) {
  return [
    { label: "鍏徃鍚嶇О", value: params.companyName?.trim() || "-" },
    { label: "鑲＄エ浠ｇ爜", value: params.stockCode?.trim() || "-" },
    { label: "鐮旂┒鐩爣", value: params.researchGoal?.trim() || "-" },
    {
      label: "鍏虫敞姒傚康",
      value:
        params.focusConcepts && params.focusConcepts.length > 0
          ? params.focusConcepts.join(" / ")
          : "-",
    },
    { label: "鐘舵€?", value: formatStatusLabel(params.status) },
    { label: "鐢熸垚鏃堕棿", value: formatDate(params.generatedAt) },
  ];
}

function findConfidenceSummary(analysis: ConfidenceAnalysis | null) {
  return {
    score:
      analysis?.finalScore === null || analysis?.finalScore === undefined
        ? "鏈垎鏋?"
        : String(analysis.finalScore),
    level: formatConfidenceLevel(analysis?.level),
    coverage:
      analysis?.evidenceCoverageScore === undefined
        ? "鏈垎鏋?"
        : `${analysis.evidenceCoverageScore}%`,
    notes: uniqueList(analysis?.notes ?? [], 3),
  };
}

function buildQuestionCards(result: CompanyResearchResultDto) {
  const referenceMap = new Map(
    result.references.map((item) => [item.id, item] as const),
  );
  const findingByQuestion = new Map(
    result.findings.map((item) => [item.question, item] as const),
  );
  const questionKeys = [
    ...new Set([
      ...result.deepQuestions.map((item) => item.question),
      ...result.findings.map((item) => item.question),
    ]),
  ];

  return questionKeys.map((question, index) => {
    const deepQuestion =
      result.deepQuestions.find((item) => item.question === question) ?? null;
    const finding = findingByQuestion.get(question) ?? null;
    const referencePreview = (finding?.referenceIds ?? [])
      .map((item) => referenceMap.get(item))
      .filter((item): item is CompanyResearchReferenceItem => Boolean(item))
      .slice(0, 3);

    return {
      id: `question-${index + 1}`,
      question,
      whyImportant:
        deepQuestion?.whyImportant ??
        "鐢ㄤ簬楠岃瘉鏈鍏徃鐮旂┒鏍稿績鍋囪銆?",
      targetMetric: deepQuestion?.targetMetric ?? "寰呰ˉ鍏?",
      dataHint: deepQuestion?.dataHint ?? "寰呰ˉ鍏?",
      answer: finding?.answer ?? "鏆傛棤缁撴瀯鍖栧洖绛斻€?",
      confidence: finding?.confidence ?? "low",
      referenceCount: finding?.referenceIds.length ?? referencePreview.length,
      gapCount: finding?.gaps.length ?? 0,
      gaps: finding?.gaps ?? [],
      referencePreview,
    } satisfies CompanyResearchQuestionCard;
  });
}

function buildReferenceFilters(references: CompanyResearchReferenceItem[]) {
  const sourceTypes = ["official", "financial", "news", "industry"] as const;
  const filters: CompanyResearchReferenceFilter[] = [
    { id: "all", label: "鍏ㄩ儴", count: references.length },
    ...sourceTypes.map((type) => ({
      id: type,
      label: formatSourceTypeLabel(type),
      count: references.filter((item) => item.sourceType === type).length,
    })),
    {
      id: "first_party",
      label: "涓€鎵?",
      count: references.filter((item) => item.sourceTier === "first_party")
        .length,
    },
    {
      id: "third_party",
      label: "涓夋柟",
      count: references.filter((item) => item.sourceTier === "third_party")
        .length,
    },
  ];

  return filters.filter((item) => item.id === "all" || item.count > 0);
}

function filterReferences(
  references: CompanyResearchReferenceItem[],
  filterId: string,
) {
  if (filterId === "all") {
    return references;
  }

  if (filterId === "first_party" || filterId === "third_party") {
    return references.filter((item) => item.sourceTier === filterId);
  }

  return references.filter((item) => item.sourceType === filterId);
}

function readFirstString(
  value: Record<string, unknown>,
  keys: string[],
  fallback: string,
) {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return fallback;
}

function normalizeConceptCards(value: unknown): CompanyResearchConceptCard[] {
  const sourceItems = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.concept_insights)
      ? value.concept_insights
      : [];

  return sourceItems
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item, index) => ({
      id: `concept-${index + 1}`,
      concept: readFirstString(item, ["concept"], `concept_${index + 1}`),
      whyItMatters: readFirstString(
        item,
        ["whyItMatters", "insight"],
        "鏆傛棤鎽樿",
      ),
      companyFit: readFirstString(item, ["companyFit"], "寰呰ˉ鍏?"),
      monetizationPath: readFirstString(item, ["monetizationPath"], "寰呰ˉ鍏?"),
      maturity: readFirstString(
        item,
        ["maturity", "research_priority"],
        "鏈煡",
      ),
    }));
}

function buildReferenceStats(result: CompanyResearchResultDto) {
  const summary = result.collectionSummary;

  return [
    {
      label: "鍘熷璇佹嵁",
      value: String(summary?.totalRawCount ?? result.evidence.length),
    },
    {
      label: "鍏ラ€夎瘉鎹?",
      value: String(summary?.totalCuratedCount ?? result.evidence.length),
    },
    {
      label: "寮曠敤",
      value: String(summary?.totalReferenceCount ?? result.references.length),
    },
    {
      label: "涓€鎵嬩俊婧?",
      value: String(
        summary?.totalFirstPartyCount ??
          result.references.filter((item) => item.sourceTier === "first_party")
            .length,
      ),
    },
  ];
}

export function buildCompanyResearchDetailModel(params: {
  status?: string;
  result?: unknown;
  input?: unknown;
  currentNodeKey?: string;
}): CompanyResearchDetailPageModel | null {
  if (isCompanyResearchResult(params.result)) {
    const result = params.result;
    const digest = buildResearchDigest({
      templateCode: COMPANY_RESEARCH_TEMPLATE_CODE,
      status: params.status,
      currentNodeKey: params.currentNodeKey,
      result,
    });
    const confidenceSummary = findConfidenceSummary(
      extractConfidenceAnalysis(result),
    );

    return {
      kind: "detail",
      backgroundItems: buildBackgroundItemsFromBrief({
        companyName: result.brief.companyName,
        stockCode: result.brief.stockCode,
        researchGoal: result.brief.researchGoal,
        focusConcepts: result.brief.focusConcepts,
        status: params.status,
        generatedAt: result.generatedAt,
      }),
      digest,
      confidenceSummary,
      conceptCards: normalizeConceptCards(result.conceptInsights),
      questionCards: buildQuestionCards(result),
      referenceFilters: buildReferenceFilters(result.references),
      collectors: result.collectionSummary?.collectors ?? [],
      references: result.references,
      referenceStats: buildReferenceStats(result),
    };
  }

  if (params.status === "PAUSED") {
    const input = isRecord(params.input) ? params.input : {};
    return {
      kind: "paused_fallback",
      backgroundItems: buildBackgroundItemsFromBrief({
        companyName:
          typeof input.companyName === "string" ? input.companyName : undefined,
        stockCode:
          typeof input.stockCode === "string" ? input.stockCode : undefined,
        researchGoal:
          isRecord(input.researchPreferences) &&
          typeof input.researchPreferences.researchGoal === "string"
            ? input.researchPreferences.researchGoal
            : undefined,
        focusConcepts: Array.isArray(input.focusConcepts)
          ? input.focusConcepts.filter(
              (item): item is string => typeof item === "string",
            )
          : undefined,
        status: params.status,
      }),
      blockers: uniqueList(
        toStringList(
          (params.result as Record<string, unknown> | undefined)?.qualityFlags,
        ).map(formatRuntimeIssueLabel),
        4,
      ),
      nextActions: uniqueList(
        [
          ...toStringList(
            (params.result as Record<string, unknown> | undefined)
              ?.missingRequirements,
          ),
          params.currentNodeKey
            ? formatWorkflowNodeLabel(params.currentNodeKey)
            : undefined,
        ],
        4,
      ),
    };
  }

  return null;
}

function SummarySection(props: { model: CompanyResearchDetailModel }) {
  return (
    <Panel
      title="鎶曡祫缁撹"
      description="鍏堢湅绔嬪満銆佺悊鐢便€侀闄╁拰涓嬩竴姝ュ姩浣溿€?"
    >
      <div className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {props.model.backgroundItems.map((item) => (
            <div
              key={item.label}
              className="rounded-[12px] border border-[var(--app-border-soft)] bg-[var(--app-bg-floating)] px-4 py-3"
            >
              <div className="text-xs text-[var(--app-text-soft)]">
                {item.label}
              </div>
              <div className="mt-2 text-sm text-[var(--app-text)]">
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="grid gap-4">
            <MarkdownContent content={props.model.digest.summary} />
            <KeyPointList
              title="鐪嬪閫昏緫"
              items={props.model.digest.bullPoints.map((item) => (
                <MarkdownContent key={item} content={item} compact />
              ))}
              emptyText="鏆傛棤鐪嬪閫昏緫"
              tone="success"
            />
            <KeyPointList
              title="椋庨櫓鐐?"
              items={props.model.digest.bearPoints.map((item) => (
                <MarkdownContent key={item} content={item} compact />
              ))}
              emptyText="鏆傛棤椋庨櫓鐐?"
              tone="warning"
            />
          </div>
          <div className="grid gap-4">
            <Panel surface="inset" title="鍙俊搴︽憳瑕?">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-[var(--app-text-soft)]">
                    寰楀垎
                  </div>
                  <div className="mt-2 text-2xl text-[var(--app-text)]">
                    {props.model.confidenceSummary.score}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[var(--app-text-soft)]">
                    绛夌骇
                  </div>
                  <div className="mt-2 text-2xl text-[var(--app-text)]">
                    {props.model.confidenceSummary.level}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[var(--app-text-soft)]">
                    瑕嗙洊鐜?
                  </div>
                  <div className="mt-2 text-2xl text-[var(--app-text)]">
                    {props.model.confidenceSummary.coverage}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusPill
                  label={props.model.digest.verdictLabel}
                  tone={props.model.digest.verdictTone}
                />
                <StatusPill
                  label={props.model.confidenceSummary.level}
                  tone={confidenceTone(
                    props.model.confidenceSummary.level === "楂?"
                      ? "high"
                      : props.model.confidenceSummary.level === "涓?"
                        ? "medium"
                        : props.model.confidenceSummary.level === "浣?"
                          ? "low"
                          : undefined,
                  )}
                />
              </div>
              {props.model.confidenceSummary.notes.length > 0 ? (
                <div className="mt-4 grid gap-2">
                  {props.model.confidenceSummary.notes.map((item) => (
                    <div
                      key={item}
                      className="rounded-[10px] border border-[var(--app-border-soft)] bg-[var(--app-panel-soft)] px-3 py-2 text-sm leading-6 text-[var(--app-text-muted)]"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              ) : null}
            </Panel>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function ConceptsSection(props: { model: CompanyResearchDetailModel }) {
  return (
    <Panel
      title="涓氬姟涓庢蹇?"
      description="鑱氱劍涓氬姟濂戝悎鐐广€佹蹇靛厬鐜板拰鍙樼幇璺緞銆?"
    >
      {props.model.conceptCards.length === 0 ? (
        <EmptyState title="鏆傛棤姒傚康鍗＄墖" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {props.model.conceptCards.map((card) => (
            <article
              key={card.id}
              className="rounded-[12px] border border-[var(--app-border-soft)] bg-[var(--app-surface)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-lg text-[var(--app-text-strong)]">
                  {card.concept}
                </div>
                <StatusPill label={card.maturity} tone="info" />
              </div>
              <MarkdownContent
                content={card.whyItMatters}
                compact
                className="mt-3"
              />
              <MarkdownContent
                content={card.companyFit}
                compact
                className="mt-3"
              />
              <MarkdownContent
                content={card.monetizationPath}
                compact
                className="mt-3"
              />
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}

function QuestionsSection(props: {
  model: CompanyResearchDetailModel;
  expandedQuestionId?: string | null;
  onQuestionToggle?: (questionId: string) => void;
}) {
  return (
    <Panel
      title="鍏抽敭闂"
      description="鎸夌爺绌堕棶棰樻煡鐪嬬瓟妗堛€佺疆淇″害鍜岃瘉鎹瑙堛€?"
    >
      {props.model.questionCards.length === 0 ? (
        <EmptyState title="鏆傛棤闂鍗＄墖" />
      ) : (
        <div className="grid gap-3">
          {props.model.questionCards.map((item) => {
            const expanded = props.expandedQuestionId === item.id;

            return (
              <article
                key={item.id}
                className="rounded-[12px] border border-[var(--app-border-soft)] bg-[var(--app-surface)] p-4"
              >
                <button
                  type="button"
                  onClick={() => props.onQuestionToggle?.(item.id)}
                  className="w-full text-left"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-[15px] text-[var(--app-text-strong)]">
                      {item.question}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusPill
                        label={`${item.referenceCount} 寮曠敤`}
                        tone="info"
                      />
                      <StatusPill
                        label={`${item.gapCount} 缂哄彛`}
                        tone={item.gapCount > 0 ? "warning" : "neutral"}
                      />
                    </div>
                  </div>
                </button>
                {expanded ? (
                  <div className="mt-4 grid gap-3">
                    <MarkdownContent content={item.whyImportant} compact />
                    <MarkdownContent content={item.targetMetric} compact />
                    <MarkdownContent content={item.dataHint} compact />
                    <MarkdownContent content={item.answer} compact />
                    {item.referencePreview.length > 0 ? (
                      <div className="grid gap-2">
                        {item.referencePreview.map((reference) => (
                          <div
                            key={reference.id}
                            className="rounded-[10px] border border-[var(--app-border-soft)] bg-[var(--app-panel-soft)] px-3 py-2 text-sm text-[var(--app-text-muted)]"
                          >
                            {reference.title}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {item.gaps.length > 0 ? (
                      <div className="grid gap-2">
                        {item.gaps.map((gap) => (
                          <div
                            key={gap}
                            className="rounded-[10px] border border-[var(--app-warning-border)] bg-[var(--app-warning-surface)] px-3 py-2 text-sm text-[var(--app-text-muted)]"
                          >
                            {gap}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function ReferencesSection(props: {
  model: CompanyResearchDetailModel;
  referenceFilterId?: string;
  onReferenceFilterChange?: (filterId: string) => void;
}) {
  const filteredReferences = filterReferences(
    props.model.references,
    props.referenceFilterId ?? "all",
  );

  return (
    <Panel
      title="寮曠敤涓庢潵婧?"
      description="瀹℃煡璇佹嵁瑕嗙洊銆佹潵婧愮被鍨嬪拰寮曠敤鍐呭銆?"
    >
      <div className="grid gap-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {props.model.referenceStats.map((item) => (
            <div
              key={item.label}
              className="rounded-[12px] border border-[var(--app-border-soft)] bg-[var(--app-bg-floating)] px-4 py-3"
            >
              <div className="text-xs text-[var(--app-text-soft)]">
                {item.label}
              </div>
              <div className="mt-2 text-2xl text-[var(--app-text)]">
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {props.model.referenceFilters.map((item) => {
            const active = item.id === (props.referenceFilterId ?? "all");
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => props.onReferenceFilterChange?.(item.id)}
                className={
                  active
                    ? "rounded-[10px] border border-[var(--app-border-strong)] bg-[var(--app-panel-strong)] px-3 py-2 text-sm text-[var(--app-text-strong)]"
                    : "rounded-[10px] border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text-muted)] transition-colors hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-strong)]"
                }
              >
                {item.label} {item.count}
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <div className="grid gap-3">
            {props.model.collectors.map((collector) => (
              <div
                key={collector.collectorKey}
                className="rounded-[12px] border border-[var(--app-border-soft)] bg-[var(--app-bg-floating)] px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-[var(--app-text)]">
                    {collector.label}
                  </div>
                  <StatusPill
                    label={collector.configured ? "宸插惎鐢?" : "宸茶烦杩?"}
                    tone={collector.configured ? "info" : "warning"}
                  />
                </div>
                <div className="mt-2 text-xs leading-6 text-[var(--app-text-muted)]">
                  鍘熷 {collector.rawCount} / 鍏ラ€?{collector.curatedCount} /
                  涓€鎵?{collector.firstPartyCount}
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3">
            {filteredReferences.length === 0 ? (
              <EmptyState title="褰撳墠绛涢€変笅鏆傛棤寮曠敤" />
            ) : (
              filteredReferences.map((reference) => (
                <article
                  key={reference.id}
                  className="rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] px-4 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill
                      label={formatSourceTypeLabel(reference.sourceType)}
                      tone="neutral"
                    />
                    <StatusPill
                      label={formatSourceTierLabel(reference.sourceTier)}
                      tone={
                        reference.sourceTier === "first_party"
                          ? "success"
                          : "neutral"
                      }
                    />
                    {reference.url ? (
                      <Link
                        href={reference.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-[var(--app-accent-strong)] hover:underline"
                      >
                        {reference.title}
                      </Link>
                    ) : (
                      <span className="text-sm text-[var(--app-text)]">
                        {reference.title}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-[var(--app-text-soft)]">
                    {reference.sourceName}
                    {reference.publishedAt
                      ? ` 路 ${reference.publishedAt}`
                      : ""}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[var(--app-text)]">
                    {reference.extractedFact}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--app-text-muted)]">
                    {reference.snippet}
                  </p>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function CompanyResearchDetailPanels(props: {
  model: CompanyResearchDetailModel;
  expandedQuestionId?: string | null;
  onQuestionToggle?: (questionId: string) => void;
  referenceFilterId?: string;
  onReferenceFilterChange?: (filterId: string) => void;
}) {
  const expandedQuestionId =
    props.expandedQuestionId ?? props.model.questionCards[0]?.id ?? null;
  const referenceFilterId = props.referenceFilterId ?? "all";

  return (
    <div className="grid gap-6">
      <SummarySection model={props.model} />
      <ConceptsSection model={props.model} />
      <QuestionsSection
        model={props.model}
        expandedQuestionId={expandedQuestionId}
        onQuestionToggle={props.onQuestionToggle}
      />
      <ReferencesSection
        model={props.model}
        referenceFilterId={referenceFilterId}
        onReferenceFilterChange={props.onReferenceFilterChange}
      />
    </div>
  );
}

export function CompanyResearchDetailContent(props: {
  model: CompanyResearchDetailModel;
}) {
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(
    props.model.questionCards[0]?.id ?? null,
  );
  const [referenceFilterId, setReferenceFilterId] = useState("all");

  const stableExpandedQuestionId = useMemo(() => {
    if (
      expandedQuestionId &&
      props.model.questionCards.some((item) => item.id === expandedQuestionId)
    ) {
      return expandedQuestionId;
    }

    return props.model.questionCards[0]?.id ?? null;
  }, [expandedQuestionId, props.model.questionCards]);

  return (
    <div className="grid gap-6">
      <CompanyResearchDetailPanels
        model={props.model}
        expandedQuestionId={stableExpandedQuestionId}
        onQuestionToggle={(questionId) =>
          setExpandedQuestionId((current) =>
            current === questionId ? null : questionId,
          )
        }
        referenceFilterId={referenceFilterId}
        onReferenceFilterChange={setReferenceFilterId}
      />
    </div>
  );
}

export function CompanyResearchPausedFallbackPanel(props: {
  model: CompanyResearchPausedFallbackModel;
}) {
  return (
    <div className="grid gap-6">
      <Panel
        title="宸叉殏鍋?"
        description="褰撳墠杩樻病鏈夊畬鏁寸殑缁撴瀯鍖栧叕鍙哥爺绌剁粨鏋滐紝鍏堝鐞嗘殏鍋滃師鍥犲啀缁х画銆?"
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <KeyPointList
            title="褰撳墠闃诲椤?"
            items={props.model.blockers.map((item) => (
              <MarkdownContent key={item} content={item} compact />
            ))}
            emptyText="鏆傛棤闃诲椤广€?"
            tone="warning"
          />
          <KeyPointList
            title="寤鸿鍔ㄤ綔"
            items={props.model.nextActions.map((item) => (
              <MarkdownContent key={item} content={item} compact />
            ))}
            emptyText="鏆傛棤寤鸿鍔ㄤ綔銆?"
            tone="info"
          />
        </div>
      </Panel>
    </div>
  );
}
