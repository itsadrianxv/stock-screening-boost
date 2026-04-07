import { describe, expect, it, vi } from "vitest";
import { WorkflowDomainError } from "~/server/domain/workflow/errors";

async function loadClient() {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.DATABASE_URL ??= "https://example.com/db";
  process.env.REDIS_URL ??= "redis://127.0.0.1:6379";
  process.env.PYTHON_SERVICE_URL ??= "http://127.0.0.1:8000";
  process.env.PYTHON_SERVICE_TIMEOUT_MS ??= "60000";
  process.env.PYTHON_INTELLIGENCE_SERVICE_URL ??= "http://127.0.0.1:8000";
  process.env.PYTHON_INTELLIGENCE_SERVICE_TIMEOUT_MS ??= "300000";

  const module = await import(
    "~/server/infrastructure/capabilities/python-capability-gateway-client"
  );

  return module.PythonCapabilityGatewayClient;
}

describe("PythonCapabilityGatewayClient", () => {
  it("uses the capability screening endpoint for dataset queries", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        meta: {
          traceId: "req-screening",
          provider: "ifind",
          capability: "screening",
          operation: "query_dataset",
        },
        data: {
          periods: ["2024"],
          indicatorMeta: [],
          rows: [],
          latestSnapshotRows: [],
          warnings: [],
          dataStatus: "READY",
          provider: "ifind",
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const PythonCapabilityGatewayClient = await loadClient();
    const client = new PythonCapabilityGatewayClient({
      baseUrl: "http://127.0.0.1:8000/api",
      screeningTimeoutMs: 500,
      intelligenceTimeoutMs: 500,
    });

    const payload = await client.queryScreeningDataset({
      stockCodes: ["600519"],
      indicators: [],
      formulas: [],
      timeConfig: {
        periodType: "ANNUAL",
        rangeMode: "PRESET",
        presetKey: "1Y",
      },
    });

    expect(payload.provider).toBe("ifind");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/v1/capabilities/screening/query-dataset",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("raises workflow error with traceId from capability envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () =>
          JSON.stringify({
            error: {
              traceId: "req-web-1",
              provider: "firecrawl",
              capability: "web",
              operation: "search",
              code: "firecrawl_unavailable",
              message: "Firecrawl upstream failed",
              retryable: true,
              failurePhase: "request",
              diagnostics: {
                endpoint: "https://api.firecrawl.dev/v2/search",
              },
            },
          }),
      }),
    );

    const PythonCapabilityGatewayClient = await loadClient();
    const client = new PythonCapabilityGatewayClient({
      baseUrl: "http://127.0.0.1:8000",
      screeningTimeoutMs: 500,
      intelligenceTimeoutMs: 500,
    });

    await expect(
      client.searchWeb({
        queries: ["算力"],
        limit: 5,
      }),
    ).rejects.toBeInstanceOf(WorkflowDomainError);

    await expect(
      client.searchWeb({
        queries: ["算力"],
        limit: 5,
      }),
    ).rejects.toThrow("traceId=req-web-1");
  });
});
