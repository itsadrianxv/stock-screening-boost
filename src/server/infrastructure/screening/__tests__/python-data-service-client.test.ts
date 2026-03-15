import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IndicatorField } from "~/server/domain/screening/enums/indicator-field.js";
import { DataNotAvailableError } from "~/server/domain/screening/errors.js";
import { StockCode } from "~/server/domain/screening/value-objects/stock-code.js";
import { PythonDataServiceClient } from "../python-data-service-client";

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("PythonDataServiceClient", () => {
  let client: PythonDataServiceClient;
  const baseUrl = "http://localhost:8000";
  const originalPythonServiceTimeoutMs = process.env.PYTHON_SERVICE_TIMEOUT_MS;

  beforeEach(() => {
    delete process.env.PYTHON_SERVICE_TIMEOUT_MS;
    client = new PythonDataServiceClient({
      baseUrl,
      timeout: 5000,
    });
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalPythonServiceTimeoutMs === undefined) {
      delete process.env.PYTHON_SERVICE_TIMEOUT_MS;
      return;
    }

    process.env.PYTHON_SERVICE_TIMEOUT_MS = originalPythonServiceTimeoutMs;
  });

  it("uses v1 market route for stock codes", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          codes: ["600519", "000001"],
          total: 2,
        },
      }),
    });

    const result = await client.getAllStockCodes();

    expect(mockFetch).toHaveBeenCalledWith(
      `${baseUrl}/api/v1/market/stocks/codes`,
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
    expect(result.map((item) => item.value)).toEqual(["600519", "000001"]);
  });

  it("maps v1 stock snapshot payload to Stock", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          stockCode: "600519",
          stockName: "贵州茅台",
          industry: "白酒",
          sector: "主板",
          roe: 0.28,
          pe: 35.5,
          pb: 10.2,
          marketCap: 21000.0,
          floatMarketCap: 20500.0,
          asOf: "2026-03-15T08:00:00+00:00",
        },
      }),
    });

    const result = await client.getStock(StockCode.create("600519"));

    expect(result).not.toBeNull();
    expect(result?.code.value).toBe("600519");
    expect(result?.name).toBe("贵州茅台");
    expect(result?.industry).toBe("白酒");
    expect(result?.sector).toBe("主板");
    expect(result?.roe).toBe(0.28);
  });

  it("returns null when v1 stock snapshot returns 404", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "stock not found",
    });

    const result = await client.getStock(StockCode.create("600000"));

    expect(result).toBeNull();
  });

  it("uses v1 batch route and unwraps items", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          items: [
            {
              stockCode: "600519",
              stockName: "贵州茅台",
              industry: "白酒",
              sector: "主板",
              marketCap: 21000.0,
              floatMarketCap: 20500.0,
              asOf: "2026-03-15T08:00:00+00:00",
            },
            {
              stockCode: "000001",
              stockName: "平安银行",
              industry: "银行",
              sector: "主板",
              marketCap: 3000.0,
              floatMarketCap: 2900.0,
              asOf: "2026-03-15T08:00:00+00:00",
            },
          ],
          errors: [],
        },
      }),
    });

    const result = await client.getStocksByCodes([
      StockCode.create("600519"),
      StockCode.create("000001"),
    ]);

    expect(mockFetch).toHaveBeenCalledWith(
      `${baseUrl}/api/v1/market/stocks/batch`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ stockCodes: ["600519", "000001"] }),
      }),
    );
    expect(result).toHaveLength(2);
    expect(result[0]?.code.value).toBe("600519");
    expect(result[1]?.code.value).toBe("000001");
  });

  it("uses v1 industries route", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          industries: ["白酒", "银行", "医药"],
          total: 3,
        },
      }),
    });

    const result = await client.getAvailableIndustries();

    expect(mockFetch).toHaveBeenCalledWith(
      `${baseUrl}/api/v1/market/stocks/industries`,
      expect.anything(),
    );
    expect(result).toEqual(["白酒", "银行", "医药"]);
  });

  it("uses v1 history route and unwraps points", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          stockCode: "600519",
          indicator: "REVENUE",
          years: 3,
          points: [
            {
              date: "2022-12-31",
              value: 1094.2,
              isEstimated: false,
            },
            {
              date: "2023-12-31",
              value: 1275.5,
              isEstimated: false,
            },
          ],
        },
      }),
    });

    const result = await client.getIndicatorHistory(
      StockCode.create("600519"),
      IndicatorField.REVENUE,
      3,
    );

    expect(mockFetch).toHaveBeenCalledWith(
      `${baseUrl}/api/v1/market/stocks/600519/history?indicator=${IndicatorField.REVENUE}&years=3`,
      expect.anything(),
    );
    expect(result).toHaveLength(2);
    expect(result[0]?.value).toBe(1094.2);
    expect(result[1]?.value).toBe(1275.5);
  });

  it("keeps legacy stock mapping compatibility for direct mapper usage", () => {
    const mapToStock = (
      client as unknown as {
        mapToStock: (data: unknown) => {
          code: { value: string };
          name: string;
          industry: string;
        };
      }
    ).mapToStock;

    const result = mapToStock.call(client, {
      code: "000001",
      name: "平安银行",
      industry: "银行",
      sector: "主板",
      dataDate: "2024-01-15",
    });

    expect(result).not.toBeNull();
    if (!result) {
      throw new Error("expected stock mapping result");
    }

    expect(result.code.value).toBe("000001");
    expect(result.name).toBe("平安银行");
    expect(result.industry).toBe("银行");
  });

  it("throws DataNotAvailableError on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    await expect(client.getAllStockCodes()).rejects.toThrow(
      DataNotAvailableError,
    );
    await expect(client.getAllStockCodes()).rejects.toThrow(
      "Python 数据服务请求失败",
    );
  });

  it("throws timeout error with configured timeout", async () => {
    const shortTimeoutClient = new PythonDataServiceClient({
      baseUrl,
      timeout: 100,
    });
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    mockFetch.mockRejectedValue(abortError);

    await expect(shortTimeoutClient.getAllStockCodes()).rejects.toThrow(
      DataNotAvailableError,
    );
    await expect(shortTimeoutClient.getAllStockCodes()).rejects.toThrow(
      "100ms",
    );
  });

  it("resolves /api, /api/stocks, and /api/v1 base URLs to v1 market paths", async () => {
    const cases = [
      [
        "http://localhost:8000/api",
        "http://localhost:8000/api/v1/market/stocks/codes",
      ],
      [
        "http://localhost:8000/api/stocks",
        "http://localhost:8000/api/v1/market/stocks/codes",
      ],
      [
        "http://localhost:8000/api/v1",
        "http://localhost:8000/api/v1/market/stocks/codes",
      ],
      [
        "http://localhost:8000/api/v1/market",
        "http://localhost:8000/api/v1/market/stocks/codes",
      ],
    ] as const;

    for (const [inputBaseUrl, expectedUrl] of cases) {
      const configuredClient = new PythonDataServiceClient({
        baseUrl: inputBaseUrl,
        timeout: 5000,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { codes: [], total: 0 } }),
      });

      await configuredClient.getAllStockCodes();

      expect(mockFetch).toHaveBeenLastCalledWith(
        expectedUrl,
        expect.anything(),
      );
    }
  });

  it("uses env timeout when timeout is not provided", async () => {
    process.env.PYTHON_SERVICE_TIMEOUT_MS = "45000";
    const envTimeoutClient = new PythonDataServiceClient({
      baseUrl,
    });

    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    mockFetch.mockRejectedValueOnce(abortError);

    await expect(envTimeoutClient.getAllStockCodes()).rejects.toThrow(
      "45000ms",
    );
  });
});
