import { EvidenceReference } from "~/server/domain/intelligence/entities/evidence-reference";
import type {
  CompanyEvidence,
  ScreeningFactsBundle,
} from "~/server/domain/intelligence/types";
import type { ScreeningSession } from "~/server/domain/screening/aggregates/screening-session";
import type { ScoredStock } from "~/server/domain/screening/value-objects/scored-stock";

function mapConfidence(score?: number) {
  if ((score ?? 0) >= 0.75) {
    return "high" as const;
  }

  if ((score ?? 0) >= 0.45) {
    return "medium" as const;
  }

  return "low" as const;
}

export function mapScreeningStockToFactsBundle(
  session: ScreeningSession,
  stock: ScoredStock,
  evidence: CompanyEvidence | null,
): ScreeningFactsBundle {
  const stockData = stock.toDict();
  const scoreBreakdown = stockData.scoreBreakdown as Record<string, number>;
  const scoreContributions = stockData.scoreContributions as Record<
    string,
    number
  >;
  const indicatorValues = stockData.indicatorValues as Record<string, unknown>;
  const matchedConditions = stockData.matchedConditions as Array<{
    field: string;
    operator: string;
    value: Record<string, unknown>;
  }>;
  const scoreExplanations = stockData.scoreExplanations as string[];

  return {
    stock: {
      stockCode: stock.stockCode.value,
      stockName: stock.stockName,
    },
    screening: {
      screeningSessionId: session.id,
      strategyId: session.strategyId,
      strategyName: session.strategyName,
      executedAt: session.executedAt.toISOString(),
      score: stock.score,
      scorePercent: stock.score * 100,
      matchedConditions,
      scoreBreakdown,
      scoreContributions,
      indicatorValues,
      scoreExplanations,
    },
    marketSignals: {
      totalScanned: session.totalScanned,
      matchedCount: session.countMatched(),
      executionTimeMs: session.executionTime,
      evidenceCredibilityScore: evidence?.credibilityScore,
    },
    conceptMatches: evidence?.concept
      ? [
          {
            concept: evidence.concept,
            confidence: mapConfidence(evidence.credibilityScore),
            rationale: evidence.evidenceSummary,
          },
        ]
      : [],
    news: [],
    companyEvidence: evidence
      ? [
          {
            title: `${evidence.companyName} 证据摘要`,
            sourceName: "python-intelligence-service",
            snippet: evidence.evidenceSummary,
            extractedFact: evidence.evidenceSummary,
            publishedAt: evidence.updatedAt,
            credibilityScore: evidence.credibilityScore,
          },
        ]
      : [],
    asOf: new Date().toISOString(),
  };
}

export function buildInsightEvidenceRefs(
  session: ScreeningSession,
  stock: ScoredStock,
  evidence: CompanyEvidence | null,
) {
  const refs = [
    EvidenceReference.create({
      title: `${stock.stockName} 筛选结果快照`,
      sourceName: "screening-session",
      snippet:
        stock.scoreExplanations[0] ??
        `${stock.stockName} 在策略 ${session.strategyName} 中评分靠前。`,
      extractedFact: [
        `评分 ${Math.round(stock.score * 100)} 分`,
        `命中 ${stock.matchedConditions.length} 个条件`,
      ].join("；"),
      publishedAt:
        session.completedAt?.toISOString() ?? session.executedAt.toISOString(),
      credibilityScore: stock.score,
    }),
  ];

  if (evidence) {
    refs.push(
      EvidenceReference.create({
        title: `${evidence.companyName} 外部证据摘要`,
        sourceName: "python-intelligence-service",
        snippet: evidence.evidenceSummary,
        extractedFact: evidence.evidenceSummary,
        publishedAt: evidence.updatedAt,
        credibilityScore: evidence.credibilityScore,
      }),
    );
  }

  return refs;
}
