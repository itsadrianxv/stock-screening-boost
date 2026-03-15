import { describe, expect, it } from "vitest";
import {
  buildResearchDigest,
  extractConfidenceAnalysis,
} from "~/app/workflows/research-view-models";
import {
  COMPANY_RESEARCH_TEMPLATE_CODE,
  QUICK_RESEARCH_TEMPLATE_CODE,
} from "~/server/domain/workflow/types";

describe("research-view-models", () => {
  it("extracts confidence analysis from quick research results", () => {
    const result = {
      overview: "Overview",
      heatScore: 80,
      heatConclusion: "Conclusion",
      candidates: [],
      credibility: [],
      topPicks: [],
      competitionSummary: "Competition",
      contractScore: 91,
      confidenceAnalysis: {
        status: "COMPLETE",
        finalScore: 88,
        level: "high",
        claimCount: 2,
        supportedCount: 2,
        insufficientCount: 0,
        contradictedCount: 0,
        abstainCount: 0,
        supportRate: 1,
        insufficientRate: 0,
        contradictionRate: 0,
        abstainRate: 0,
        evidenceCoverageScore: 100,
        freshnessScore: 100,
        sourceDiversityScore: 100,
        notes: [],
        claims: [],
      },
      generatedAt: "2026-03-12T00:00:00.000Z",
    };

    expect(extractConfidenceAnalysis(result)?.finalScore).toBe(88);
    expect(
      buildResearchDigest({
        templateCode: QUICK_RESEARCH_TEMPLATE_CODE,
        query: "AI",
        status: "SUCCEEDED",
        result,
      }).metrics.some((item) => item.label === "合同得分"),
    ).toBe(true);
  });

  it("keeps generic digest working for legacy results without confidence", () => {
    const digest = buildResearchDigest({
      templateCode: QUICK_RESEARCH_TEMPLATE_CODE,
      query: "Legacy run",
      status: "SUCCEEDED",
      result: {
        legacy: "value",
      },
    });

    expect(digest.templateLabel).toBe("行业判断");
    expect(digest.metrics.length).toBeGreaterThanOrEqual(0);
  });

  it("builds company digest from v2 result fields", () => {
    const digest = buildResearchDigest({
      templateCode: COMPANY_RESEARCH_TEMPLATE_CODE,
      query: "Company run",
      status: "SUCCEEDED",
      result: {
        brief: {
          companyName: "示例公司",
          researchGoal: "验证利润兑现",
          focusConcepts: ["算力"],
          keyQuestions: [],
        },
        conceptInsights: [],
        deepQuestions: [],
        findings: [
          {
            question: "Q1",
            answer: "A1",
            confidence: "high",
            evidenceUrls: [],
            referenceIds: ["ref-1"],
            gaps: ["gap-1"],
          },
        ],
        evidence: [
          {
            referenceId: "ref-1",
            title: "官网披露",
            sourceName: "example.com",
            sourceType: "official",
            sourceTier: "first_party",
            collectorKey: "official_sources",
            isFirstParty: true,
            snippet: "snippet",
            extractedFact: "fact",
            relevance: "relevance",
          },
        ],
        references: [
          {
            id: "ref-1",
            title: "官网披露",
            sourceName: "example.com",
            sourceType: "official",
            sourceTier: "first_party",
            collectorKey: "official_sources",
            isFirstParty: true,
            snippet: "snippet",
            extractedFact: "fact",
          },
        ],
        verdict: {
          stance: "优先研究",
          summary: "值得继续研究。",
          bullPoints: ["bull"],
          bearPoints: ["bear"],
          nextChecks: ["check"],
        },
        collectionSummary: {
          collectors: [],
          totalRawCount: 4,
          totalCuratedCount: 1,
          totalReferenceCount: 1,
          totalFirstPartyCount: 1,
          notes: [],
        },
        crawler: {
          provider: "firecrawl",
          configured: true,
          queries: [],
          notes: [],
        },
        contractScore: 84,
        qualityFlags: ["citation_coverage_low"],
        generatedAt: "2026-03-12T00:00:00.000Z",
      },
    });

    expect(digest.templateLabel).toBe("公司判断");
    expect(digest.metrics.some((item) => item.label === "引用数量")).toBe(true);
    expect(digest.metrics.some((item) => item.label === "一手信源")).toBe(true);
    expect(digest.metrics.some((item) => item.label === "合同得分")).toBe(true);
  });
});
