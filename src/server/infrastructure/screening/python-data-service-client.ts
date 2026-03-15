/**
 * PythonDataServiceClient
 *
 * Infrastructure HTTP client for the Python FastAPI market gateway.
 */

import { Stock } from "~/server/domain/screening/entities/stock";
import type { IndicatorField } from "~/server/domain/screening/enums/indicator-field";
import { DataNotAvailableError } from "~/server/domain/screening/errors";
import type {
  IHistoricalDataProvider,
  IndicatorDataPoint,
} from "~/server/domain/screening/repositories/historical-data-provider";
import type { IMarketDataRepository } from "~/server/domain/screening/repositories/market-data-repository";
import { StockCode } from "~/server/domain/screening/value-objects/stock-code";

const DEFAULT_PYTHON_SERVICE_TIMEOUT_MS = 60_000;

interface LegacyStockDataResponse {
  code: string;
  name: string;
  industry: string;
  sector: string;
  roe?: number | null;
  pe?: number | null;
  pb?: number | null;
  eps?: number | null;
  revenue?: number | null;
  netProfit?: number | null;
  debtRatio?: number | null;
  marketCap?: number | null;
  floatMarketCap?: number | null;
  dataDate: string;
}

interface MarketStockResponseBody {
  stockCode: string;
  stockName: string;
  industry: string;
  sector?: string | null;
  roe?: number | null;
  pe?: number | null;
  pb?: number | null;
  eps?: number | null;
  revenue?: number | null;
  netProfit?: number | null;
  debtRatio?: number | null;
  marketCap?: number | null;
  floatMarketCap?: number | null;
  asOf: string;
  securityType?: string;
}

interface IndicatorDataPointResponse {
  date: string;
  value: number | null;
  isEstimated: boolean;
}

interface StockCodesDataResponse {
  codes: string[];
  total: number;
}

interface IndustriesDataResponse {
  industries: string[];
  total: number;
}

interface IndicatorHistoryDataResponse {
  stockCode: string;
  indicator: string;
  years: number;
  points: IndicatorDataPointResponse[];
}

interface StockBatchGatewayDataResponse {
  items: MarketStockResponseBody[];
  errors: Array<{
    stockCode: string;
    code: string;
    message: string;
  }>;
}

interface BatchStockRequest {
  stockCodes: string[];
}

type GatewayResponse<T> = {
  data: T;
};

export interface PythonDataServiceClientConfig {
  baseUrl: string;
  timeout?: number;
}

type ScreeningServiceBasePath = {
  baseUrl: string;
  marketBasePath: string;
};

function resolveScreeningServiceBasePath(
  rawBaseUrl: string,
): ScreeningServiceBasePath {
  const normalizedBaseUrl = rawBaseUrl.replace(/\/$/, "");

  if (normalizedBaseUrl.endsWith("/api/v1/market")) {
    return {
      baseUrl: normalizedBaseUrl,
      marketBasePath: "",
    };
  }

  if (normalizedBaseUrl.endsWith("/api/stocks")) {
    return {
      baseUrl: normalizedBaseUrl.replace(/\/stocks$/, ""),
      marketBasePath: "/v1/market",
    };
  }

  if (normalizedBaseUrl.endsWith("/api/v1")) {
    return {
      baseUrl: normalizedBaseUrl,
      marketBasePath: "/market",
    };
  }

  if (normalizedBaseUrl.endsWith("/api")) {
    return {
      baseUrl: normalizedBaseUrl,
      marketBasePath: "/v1/market",
    };
  }

  return {
    baseUrl: normalizedBaseUrl,
    marketBasePath: "/api/v1/market",
  };
}

function resolveScreeningServiceTimeoutMs(explicitTimeout?: number): number {
  if (typeof explicitTimeout === "number" && Number.isFinite(explicitTimeout)) {
    return explicitTimeout;
  }

  const rawTimeout = process.env.PYTHON_SERVICE_TIMEOUT_MS;
  if (!rawTimeout) {
    return DEFAULT_PYTHON_SERVICE_TIMEOUT_MS;
  }

  const parsedTimeout = Number.parseInt(rawTimeout, 10);
  if (!Number.isFinite(parsedTimeout) || parsedTimeout <= 0) {
    return DEFAULT_PYTHON_SERVICE_TIMEOUT_MS;
  }

  return parsedTimeout;
}

type StockLikeResponse = LegacyStockDataResponse | MarketStockResponseBody;

export class PythonDataServiceClient
  implements IMarketDataRepository, IHistoricalDataProvider
{
  private readonly baseUrl: string;
  private readonly marketBasePath: string;
  private readonly timeout: number;

  constructor(config: PythonDataServiceClientConfig) {
    const resolvedBaseUrl = resolveScreeningServiceBasePath(config.baseUrl);
    this.baseUrl = resolvedBaseUrl.baseUrl;
    this.marketBasePath = resolvedBaseUrl.marketBasePath;
    this.timeout = resolveScreeningServiceTimeoutMs(config.timeout);
  }

  private marketPath(path: string) {
    return `${this.marketBasePath}${path}`;
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "未知错误");
        throw new DataNotAvailableError(
          `Python 数据服务返回错误: ${response.status} ${response.statusText}`,
          response.status,
          errorText,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof DataNotAvailableError) {
        throw error;
      }

      if ((error as Error).name === "AbortError") {
        throw new DataNotAvailableError(
          `Python 数据服务请求超时 (${this.timeout}ms)`,
          undefined,
          { url, timeout: this.timeout },
        );
      }

      throw new DataNotAvailableError(
        `Python 数据服务请求失败: ${(error as Error).message}`,
        undefined,
        error,
      );
    }
  }

  private mapToStock(data: StockLikeResponse): Stock {
    const code = "stockCode" in data ? data.stockCode : data.code;
    const name = "stockName" in data ? data.stockName : data.name;
    const sector =
      ("sector" in data ? data.sector : undefined) ??
      ("securityType" in data && data.securityType === "etf" ? "ETF" : null) ??
      "主板";
    const dataDate = "asOf" in data ? data.asOf : data.dataDate;

    return new Stock({
      code: StockCode.create(code),
      name,
      industry: data.industry,
      sector,
      roe: data.roe ?? null,
      pe: data.pe ?? null,
      pb: data.pb ?? null,
      eps: data.eps ?? null,
      revenue: data.revenue ?? null,
      netProfit: data.netProfit ?? null,
      debtRatio: data.debtRatio ?? null,
      marketCap: data.marketCap ?? null,
      floatMarketCap: data.floatMarketCap ?? null,
      dataDate: new Date(dataDate),
    });
  }

  private mapToIndicatorDataPoint(
    data: IndicatorDataPointResponse,
  ): IndicatorDataPoint {
    return {
      date: new Date(data.date),
      value: data.value,
      isEstimated: data.isEstimated,
    };
  }

  async getAllStockCodes(): Promise<StockCode[]> {
    const response = await this.fetch<
      StockCodesDataResponse | GatewayResponse<StockCodesDataResponse>
    >(this.marketPath("/stocks/codes"));
    const payload = "data" in response ? response.data : response;
    return payload.codes.map((code) => StockCode.create(code));
  }

  async getStock(code: StockCode): Promise<Stock | null> {
    try {
      const response = await this.fetch<
        MarketStockResponseBody | GatewayResponse<MarketStockResponseBody>
      >(this.marketPath(`/stocks/${code.value}`));
      const payload = "data" in response ? response.data : response;
      return this.mapToStock(payload);
    } catch (error) {
      if (error instanceof DataNotAvailableError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async getStocksByCodes(codes: StockCode[]): Promise<Stock[]> {
    if (codes.length === 0) {
      return [];
    }

    const request: BatchStockRequest = {
      stockCodes: codes.map((code) => code.value),
    };

    const response = await this.fetch<
      | StockBatchGatewayDataResponse
      | GatewayResponse<StockBatchGatewayDataResponse>
    >(this.marketPath("/stocks/batch"), {
      method: "POST",
      body: JSON.stringify(request),
    });
    const payload = "data" in response ? response.data : response;

    return payload.items.map((data) => this.mapToStock(data));
  }

  async getAvailableIndustries(): Promise<string[]> {
    const response = await this.fetch<
      IndustriesDataResponse | GatewayResponse<IndustriesDataResponse>
    >(this.marketPath("/stocks/industries"));
    const payload = "data" in response ? response.data : response;
    return payload.industries;
  }

  async getIndicatorHistory(
    stockCode: StockCode,
    indicator: IndicatorField,
    years: number,
  ): Promise<IndicatorDataPoint[]> {
    const path = this.marketPath(
      `/${["stocks", stockCode.value, "history"].join("/")}?indicator=${indicator}&years=${years}`,
    );
    const response = await this.fetch<
      | IndicatorHistoryDataResponse
      | GatewayResponse<IndicatorHistoryDataResponse>
    >(path);
    const payload = "data" in response ? response.data : response;

    return payload.points.map((data) => this.mapToIndicatorDataPoint(data));
  }
}

export function createPythonDataServiceClient(
  baseUrl?: string,
  timeout?: number,
): PythonDataServiceClient {
  const serviceUrl =
    baseUrl ?? process.env.PYTHON_SERVICE_URL ?? "http://localhost:8000";

  return new PythonDataServiceClient({
    baseUrl: serviceUrl,
    timeout,
  });
}
