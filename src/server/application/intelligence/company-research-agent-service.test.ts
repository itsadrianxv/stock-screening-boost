import { describe, expect, it, vi } from "vitest";
import { CompanyResearchAgentService } from "~/server/application/intelligence/company-research-agent-service";
import { createUnavailableConfidenceAnalysis } from "~/server/domain/intelligence/confidence";

function createService(overrides?: {
  isConfigured?: boolean;
  scrapeUrl?: ReturnType<typeof vi.fn>;
}) {
  const scrapeUrl =
    overrides?.scrapeUrl ??
    vi.fn(async (url: string) => ({
      title: `Scraped ${url}`,
      url,
      markdown: "补齐后的网页正文，包含更完整的事实摘要。",
    }));

  return {
    service: new CompanyResearchAgentService({
      deepSeekClient: {
        completeJson: vi.fn(async (_messages, fallback) => fallback),
      } as never,
      firecrawlClient: {
        isConfigured: vi.fn(() => overrides?.isConfigured ?? true),
        scrapeUrl,
        search: vi.fn(async () => []),
      } as never,
      pythonIntelligenceDataClient: {
        getCompanyResearchPack: vi.fn(),
      } as never,
      confidenceAnalysisService: {
        analyzeCompanyResearch: vi.fn(async () =>
          createUnavailableConfidenceAnalysis(["stub"]),
        ),
      } as never,
    }),
    scrapeUrl,
  };
}

describe("CompanyResearchAgentService", () => {
  it("grounds first-party and third-party supplemental urls correctly", () => {
    const { service } = createService();

    const grounded = service.groundSources({
      input: {
        companyName: "示例公司",
        officialWebsite: "example.com",
        supplementalUrls: [
          "https://www.example.com/investor",
          "https://www.cninfo.com.cn/disclosure/detail",
          "https://news.example.org/story",
        ],
      },
      brief: {
        companyName: "示例公司",
        officialWebsite: "https://example.com",
        researchGoal: "验证利润兑现",
        focusConcepts: ["算力"],
        keyQuestions: [],
      },
    });

    expect(
      grounded.groundedSources.find((item) =>
        item.url.includes("example.com/investor"),
      )?.isFirstParty,
    ).toBe(true);
    expect(
      grounded.groundedSources.find((item) =>
        item.url.includes("cninfo.com.cn"),
      )?.sourceType,
    ).toBe("financial");
    expect(
      grounded.groundedSources.find((item) =>
        item.url.includes("news.example.org"),
      )?.collectorKey,
    ).toBe("news_sources");
  });

  it("prioritizes first-party evidence during curation", () => {
    const { service } = createService();

    const curated = service.curateEvidence({
      brief: {
        companyName: "示例公司",
        researchGoal: "验证利润兑现",
        focusConcepts: ["算力"],
        keyQuestions: [],
      },
      questions: [
        {
          question: "利润有没有兑现？",
          whyImportant: "判断主题是否转化为利润",
          targetMetric: "利润占比",
          dataHint: "看财报附注",
        },
      ],
      collectedEvidenceByCollector: {
        official_sources: [
          {
            referenceId: "official-ref",
            title: "官网纪要",
            sourceName: "example.com",
            url: "https://example.com/ir",
            sourceType: "official",
            sourceTier: "first_party",
            collectorKey: "official_sources",
            isFirstParty: true,
            snippet: "官网披露",
            extractedFact: "官网披露显示相关业务已经形成稳定订单。",
            relevance: "high",
          },
        ],
        news_sources: [
          {
            referenceId: "news-ref",
            title: "外部新闻",
            sourceName: "media.example",
            url: "https://media.example/story",
            sourceType: "news",
            sourceTier: "third_party",
            collectorKey: "news_sources",
            isFirstParty: false,
            snippet: "新闻报道",
            extractedFact: "外部报道提到订单增长。",
            relevance: "medium",
          },
        ],
      },
      collectorRunInfo: {
        official_sources: {
          collectorKey: "official_sources",
          configured: true,
          queries: [],
          notes: [],
        },
        news_sources: {
          collectorKey: "news_sources",
          configured: true,
          queries: [],
          notes: [],
        },
      },
      collectionNotes: [],
    });

    expect(curated.references[0]?.isFirstParty).toBe(true);
    expect(curated.collectionSummary.totalFirstPartyCount).toBe(1);
    expect(curated.collectionSummary.totalCuratedCount).toBe(2);
  });

  it("only enriches non-financial references that need more content", async () => {
    const { service, scrapeUrl } = createService();

    const enriched = await service.enrichReferences({
      references: [
        {
          id: "ref-official",
          title: "官网",
          sourceName: "example.com",
          snippet: "短摘要",
          extractedFact: "短事实",
          url: "https://example.com/ir",
          sourceType: "official",
          sourceTier: "first_party",
          collectorKey: "official_sources",
          isFirstParty: true,
        },
        {
          id: "ref-financial",
          title: "财务快照",
          sourceName: "akshare",
          snippet: "短摘要",
          extractedFact: "短事实",
          sourceType: "financial",
          sourceTier: "third_party",
          collectorKey: "financial_sources",
          isFirstParty: false,
        },
      ],
      evidence: [
        {
          referenceId: "ref-official",
          title: "官网",
          sourceName: "example.com",
          url: "https://example.com/ir",
          sourceType: "official",
          sourceTier: "first_party",
          collectorKey: "official_sources",
          isFirstParty: true,
          snippet: "短摘要",
          extractedFact: "短事实",
          relevance: "high",
        },
        {
          referenceId: "ref-financial",
          title: "财务快照",
          sourceName: "akshare",
          sourceType: "financial",
          sourceTier: "third_party",
          collectorKey: "financial_sources",
          isFirstParty: false,
          snippet: "短摘要",
          extractedFact: "短事实",
          relevance: "medium",
        },
      ],
    });

    expect(scrapeUrl).toHaveBeenCalledTimes(1);
    expect(scrapeUrl).toHaveBeenCalledWith("https://example.com/ir");
    expect(enriched.references[0]?.extractedFact).toContain("更完整");
    expect(enriched.references[1]?.extractedFact).toBe("短事实");
  });
});
