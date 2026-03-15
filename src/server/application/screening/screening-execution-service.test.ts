import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/env", () => ({
  env: {
    PYTHON_SERVICE_URL: "http://localhost:8000",
    PYTHON_SERVICE_TIMEOUT_MS: 5000,
  },
}));

import { ScreeningExecutionService } from "~/server/application/screening/screening-execution-service";
import { ScreeningSession } from "~/server/domain/screening/aggregates/screening-session";
import { ScreeningStrategy } from "~/server/domain/screening/aggregates/screening-strategy";
import { FilterGroup } from "~/server/domain/screening/entities/filter-group";
import { Stock } from "~/server/domain/screening/entities/stock";
import { ComparisonOperator } from "~/server/domain/screening/enums/comparison-operator";
import { IndicatorField } from "~/server/domain/screening/enums/indicator-field";
import { LogicalOperator } from "~/server/domain/screening/enums/logical-operator";
import type { IScreeningSessionRepository } from "~/server/domain/screening/repositories/screening-session-repository";
import type { IScreeningStrategyRepository } from "~/server/domain/screening/repositories/screening-strategy-repository";
import { FilterCondition } from "~/server/domain/screening/value-objects/filter-condition";
import { createTimeSeriesValue } from "~/server/domain/screening/value-objects/indicator-value";
import {
  NormalizationMethod,
  ScoringConfig,
} from "~/server/domain/screening/value-objects/scoring-config";
import { StockCode } from "~/server/domain/screening/value-objects/stock-code";
import { PythonDataServiceClient } from "~/server/infrastructure/screening/python-data-service-client";

class InMemorySessionRepository implements IScreeningSessionRepository {
  private readonly sessions = new Map<string, ScreeningSession>();

  constructor(session: ScreeningSession) {
    this.sessions.set(session.id, session);
  }

  async save(session: ScreeningSession): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async findById(id: string): Promise<ScreeningSession | null> {
    return this.sessions.get(id) ?? null;
  }

  async delete(_id: string): Promise<void> {}

  async findByStrategy(
    _strategyId: string,
    _limit?: number,
    _offset?: number,
  ): Promise<ScreeningSession[]> {
    return [];
  }

  async findByStrategyForUser(
    _strategyId: string,
    _userId: string,
    _limit?: number,
    _offset?: number,
  ): Promise<ScreeningSession[]> {
    return [];
  }

  async findRecentSessions(
    _limit?: number,
    _offset?: number,
  ): Promise<ScreeningSession[]> {
    return [];
  }

  async findRecentSessionsByUser(
    _userId: string,
    _limit?: number,
    _offset?: number,
  ): Promise<ScreeningSession[]> {
    return [];
  }

  async claimNextPendingSession(): Promise<ScreeningSession | null> {
    return (
      Array.from(this.sessions.values()).find(
        (session) => session.status === "PENDING",
      ) ?? null
    );
  }

  async findRunningSessions(_limit?: number): Promise<ScreeningSession[]> {
    return [];
  }
}

class StaticStrategyRepository implements IScreeningStrategyRepository {
  constructor(private readonly strategy: ScreeningStrategy) {}

  async save(_strategy: ScreeningStrategy): Promise<void> {}

  async findById(id: string): Promise<ScreeningStrategy | null> {
    return this.strategy.id === id ? this.strategy : null;
  }

  async delete(_id: string): Promise<void> {}

  async findAll(
    _limit?: number,
    _offset?: number,
  ): Promise<ScreeningStrategy[]> {
    return [];
  }

  async findByUserId(
    _userId: string,
    _limit?: number,
    _offset?: number,
  ): Promise<ScreeningStrategy[]> {
    return [];
  }

  async findTemplates(): Promise<ScreeningStrategy[]> {
    return [];
  }

  async findByName(_name: string): Promise<ScreeningStrategy | null> {
    return null;
  }
}

describe("ScreeningExecutionService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("memoizes per-session indicator history across filter and scoring phases", async () => {
    const condition = FilterCondition.create(
      IndicatorField.ROE_AVG_3Y,
      ComparisonOperator.GREATER_THAN,
      createTimeSeriesValue(3, 10),
    );
    const filters = FilterGroup.create(LogicalOperator.AND, [condition], []);
    const scoringConfig = ScoringConfig.create(
      new Map([[IndicatorField.ROE_AVG_3Y, 1]]),
      NormalizationMethod.MIN_MAX,
    );
    const strategy = ScreeningStrategy.create({
      name: "Memoization Strategy",
      filters,
      scoringConfig,
      userId: "user-1",
    });
    const session = ScreeningSession.createPending({
      strategyId: strategy.id,
      strategyName: strategy.name,
      userId: "user-1",
      filtersSnapshot: strategy.filters,
      scoringConfigSnapshot: strategy.scoringConfig,
    });

    const sessionRepository = new InMemorySessionRepository(session);
    const strategyRepository = new StaticStrategyRepository(strategy);
    const getAllStockCodesSpy = vi
      .spyOn(PythonDataServiceClient.prototype, "getAllStockCodes")
      .mockResolvedValue([StockCode.create("600519")]);
    const getStocksByCodesSpy = vi
      .spyOn(PythonDataServiceClient.prototype, "getStocksByCodes")
      .mockResolvedValue([
        new Stock({
          code: StockCode.create("600519"),
          name: "贵州茅台",
          industry: "白酒",
          sector: "主板",
          dataDate: new Date("2026-03-15"),
        }),
      ]);
    const getIndicatorHistorySpy = vi
      .spyOn(PythonDataServiceClient.prototype, "getIndicatorHistory")
      .mockResolvedValue([
        {
          date: new Date("2022-12-31"),
          value: 9,
          isEstimated: false,
        },
        {
          date: new Date("2023-12-31"),
          value: 10,
          isEstimated: false,
        },
        {
          date: new Date("2024-12-31"),
          value: 12,
          isEstimated: false,
        },
      ]);

    const service = new ScreeningExecutionService({
      sessionRepository,
      strategyRepository,
    });

    const executed = await service.executeNextPendingSession();
    const completedSession = await sessionRepository.findById(session.id);

    expect(executed).toBe(true);
    expect(getAllStockCodesSpy).toHaveBeenCalledOnce();
    expect(getStocksByCodesSpy).toHaveBeenCalledOnce();
    expect(getIndicatorHistorySpy).toHaveBeenCalledOnce();
    expect(completedSession?.status).toBe("SUCCEEDED");
  });
});
