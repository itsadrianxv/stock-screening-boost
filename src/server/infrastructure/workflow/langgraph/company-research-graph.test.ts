import { describe, expect, it, vi } from "vitest";
import type {
  CompanyResearchCollectionSummary,
  CompanyResearchGraphState,
  CompanyResearchReferenceItem,
} from "~/server/domain/workflow/types";
import {
  CompanyResearchLangGraph,
  LegacyCompanyResearchLangGraph,
} from "~/server/infrastructure/workflow/langgraph/company-research-graph";

function createGraphServiceStub() {
  const callCount = {
    buildResearchBrief: 0,
    mapConceptInsights: 0,
    designDeepQuestions: 0,
    groundSources: 0,
    collectOfficialSources: 0,
    collectFinancialSources: 0,
    collectNewsSources: 0,
    collectIndustrySources: 0,
  };

  const reference: CompanyResearchReferenceItem = {
    id: "ref-1",
    title: "官网披露",
    sourceName: "example.com",
    snippet: "snippet",
    extractedFact: "fact",
    url: "https://example.com/ir",
    sourceType: "official",
    sourceTier: "first_party",
    collectorKey: "official_sources",
    isFirstParty: true,
  };

  const collectionSummary: CompanyResearchCollectionSummary = {
    collectors: [
      {
        collectorKey: "official_sources",
        label: "官网 / IR",
        rawCount: 1,
        curatedCount: 1,
        referenceCount: 1,
        firstPartyCount: 1,
        configured: true,
        notes: [],
      },
    ],
    totalRawCount: 4,
    totalCuratedCount: 1,
    totalReferenceCount: 1,
    totalFirstPartyCount: 1,
    notes: [],
  };

  const service = {
    buildResearchBrief: vi.fn(async () => {
      callCount.buildResearchBrief += 1;
      return {
        companyName: "示例公司",
        stockCode: "600519",
        officialWebsite: "https://example.com",
        researchGoal: "验证利润兑现",
        focusConcepts: ["算力"],
        keyQuestions: ["Q1"],
      };
    }),
    mapConceptInsights: vi.fn(async () => {
      callCount.mapConceptInsights += 1;
      return [
        {
          concept: "算力",
          whyItMatters: "why",
          companyFit: "fit",
          monetizationPath: "path",
          maturity: "核心成熟" as const,
        },
      ];
    }),
    designDeepQuestions: vi.fn(async () => {
      callCount.designDeepQuestions += 1;
      return [
        {
          question: "Q1",
          whyImportant: "important",
          targetMetric: "metric",
          dataHint: "hint",
        },
      ];
    }),
    groundSources: vi.fn(() => {
      callCount.groundSources += 1;
      return {
        groundedSources: [
          {
            url: "https://example.com",
            title: "官网",
            sourceType: "official",
            sourceTier: "first_party",
            collectorKey: "official_sources",
            isFirstParty: true,
            reason: "seed",
          },
        ],
        notes: [],
      };
    }),
    collectOfficialSources: vi.fn(async () => {
      callCount.collectOfficialSources += 1;
      return {
        collectorKey: "official_sources",
        configured: true,
        queries: ["official"],
        notes: [],
        evidence: [
          {
            referenceId: "ref-1",
            title: "官网披露",
            sourceName: "example.com",
            url: "https://example.com/ir",
            sourceType: "official",
            sourceTier: "first_party",
            collectorKey: "official_sources",
            isFirstParty: true,
            snippet: "snippet",
            extractedFact: "fact",
            relevance: "high",
          },
        ],
      };
    }),
    collectFinancialSources: vi.fn(async () => {
      callCount.collectFinancialSources += 1;
      return {
        collectorKey: "financial_sources",
        configured: true,
        queries: [],
        notes: [],
        evidence: [],
      };
    }),
    collectNewsSources: vi.fn(async () => {
      callCount.collectNewsSources += 1;
      return {
        collectorKey: "news_sources",
        configured: true,
        queries: ["news"],
        notes: [],
        evidence: [],
      };
    }),
    collectIndustrySources: vi.fn(async () => {
      callCount.collectIndustrySources += 1;
      return {
        collectorKey: "industry_sources",
        configured: true,
        queries: ["industry"],
        notes: [],
        evidence: [],
      };
    }),
    buildCollectorState: vi.fn((output) => ({
      collectedEvidenceByCollector: {
        [output.collectorKey]: output.evidence,
      },
      collectorRunInfo: {
        [output.collectorKey]: {
          collectorKey: output.collectorKey,
          configured: output.configured,
          queries: output.queries,
          notes: output.notes,
        },
      },
      collectionNotes: output.notes,
      collectorPacks: {},
    })),
    curateEvidence: vi.fn(() => ({
      evidence: [
        {
          referenceId: "ref-1",
          title: "官网披露",
          sourceName: "example.com",
          url: "https://example.com/ir",
          sourceType: "official",
          sourceTier: "first_party",
          collectorKey: "official_sources",
          isFirstParty: true,
          snippet: "snippet",
          extractedFact: "fact",
          relevance: "high",
        },
      ],
      references: [reference],
      collectionSummary,
      crawler: {
        provider: "firecrawl" as const,
        configured: true,
        queries: ["official", "news", "industry"],
        notes: [],
      },
    })),
    enrichReferences: vi.fn(async ({ references, evidence }) => ({
      references,
      evidence,
    })),
    answerQuestions: vi.fn(async () => [
      {
        question: "Q1",
        answer: "A1",
        confidence: "high" as const,
        evidenceUrls: ["https://example.com/ir"],
        referenceIds: ["ref-1"],
        gaps: [],
      },
    ]),
    buildVerdict: vi.fn(async () => ({
      stance: "优先研究" as const,
      summary: "summary",
      bullPoints: ["bull"],
      bearPoints: ["bear"],
      nextChecks: ["next"],
    })),
    analyzeConfidence: vi.fn(async () => ({
      status: "UNAVAILABLE" as const,
      finalScore: null,
      level: "unknown" as const,
      claimCount: 0,
      supportedCount: 0,
      insufficientCount: 0,
      contradictedCount: 0,
      abstainCount: 0,
      supportRate: 0,
      insufficientRate: 0,
      contradictionRate: 0,
      abstainRate: 0,
      evidenceCoverageScore: 0,
      freshnessScore: 0,
      sourceDiversityScore: 0,
      notes: [],
      claims: [],
    })),
    buildFinalReport: vi.fn((params) => ({
      ...params,
      generatedAt: "2026-03-12T00:00:00.000Z",
    })),
    collectEvidence: vi.fn(async () => ({
      evidence: [],
      crawler: {
        provider: "firecrawl" as const,
        configured: false,
        queries: [],
        notes: [],
      },
    })),
  };

  return {
    service: service as never,
    callCount,
  };
}

describe("company-research-graph", () => {
  it("runs the v2 graph and merges parallel collector state", async () => {
    const { service } = createGraphServiceStub();
    const graph = new CompanyResearchLangGraph(service);

    const finalState = (await graph.execute({
      initialState: graph.buildInitialState({
        runId: "run-1",
        userId: "user-1",
        query: "示例公司",
        input: {
          companyName: "示例公司",
          stockCode: "600519",
          officialWebsite: "https://example.com",
        },
        progressPercent: 0,
      }),
    })) as CompanyResearchGraphState;

    expect(graph.templateVersion).toBe(2);
    expect(graph.getNodeOrder()).toContain("collector_official_sources");
    expect(Object.keys(finalState.collectedEvidenceByCollector ?? {})).toEqual(
      expect.arrayContaining([
        "official_sources",
        "financial_sources",
        "news_sources",
        "industry_sources",
      ]),
    );
    expect(finalState.finalReport?.collectionSummary.totalReferenceCount).toBe(
      1,
    );
  });

  it("resumes v2 execution from collector nodes when startNodeIndex is provided", async () => {
    const { service, callCount } = createGraphServiceStub();
    const graph = new CompanyResearchLangGraph(service);

    await graph.execute({
      initialState: {
        runId: "run-1",
        userId: "user-1",
        query: "示例公司",
        progressPercent: 40,
        currentNodeKey: "agent4_source_grounding",
        lastCompletedNodeKey: "agent4_source_grounding",
        resumeFromNodeKey: undefined,
        errors: [],
        researchInput: {
          companyName: "示例公司",
          stockCode: "600519",
          officialWebsite: "https://example.com",
        },
        brief: {
          companyName: "示例公司",
          stockCode: "600519",
          officialWebsite: "https://example.com",
          researchGoal: "验证利润兑现",
          focusConcepts: ["算力"],
          keyQuestions: ["Q1"],
        },
        conceptInsights: [
          {
            concept: "算力",
            whyItMatters: "why",
            companyFit: "fit",
            monetizationPath: "path",
            maturity: "核心成熟",
          },
        ],
        deepQuestions: [
          {
            question: "Q1",
            whyImportant: "important",
            targetMetric: "metric",
            dataHint: "hint",
          },
        ],
        groundedSources: [
          {
            url: "https://example.com",
            title: "官网",
            sourceType: "official",
            sourceTier: "first_party",
            collectorKey: "official_sources",
            isFirstParty: true,
            reason: "seed",
          },
        ],
      } as unknown as CompanyResearchGraphState,
      startNodeIndex: 4,
    });

    expect(callCount.buildResearchBrief).toBe(0);
    expect(callCount.groundSources).toBe(1);
    expect(callCount.collectOfficialSources).toBe(1);
    expect(callCount.collectNewsSources).toBe(1);
  });

  it("keeps a versioned legacy graph available for template v1", () => {
    const { service } = createGraphServiceStub();
    const graph = new LegacyCompanyResearchLangGraph(service);

    expect(graph.templateVersion).toBe(1);
    expect(graph.getNodeOrder()).toEqual([
      "agent1_company_briefing",
      "agent2_concept_mapping",
      "agent3_question_design",
      "agent4_evidence_collection",
      "agent5_investment_synthesis",
    ]);
  });
});
