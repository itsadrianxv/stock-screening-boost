import { randomUUID } from "node:crypto";
import { env } from "~/env";
import { ScreeningExecutionService } from "~/server/application/screening/screening-execution-service";
import { WorkflowCommandService } from "~/server/application/workflow/command-service";
import { ScreeningInsightPipelineDispatcher } from "~/server/application/workflow/screening-insight-pipeline-dispatcher";
import { db } from "~/server/db";
import { PrismaScreeningSessionRepository } from "~/server/infrastructure/screening/prisma-screening-session-repository";
import { PrismaScreeningStrategyRepository } from "~/server/infrastructure/screening/prisma-screening-strategy-repository";
import { PrismaWorkflowRunRepository } from "~/server/infrastructure/workflow/prisma/workflow-run-repository";

const sessionRepository = new PrismaScreeningSessionRepository(db);
const strategyRepository = new PrismaScreeningStrategyRepository(db);
const workflowRepository = new PrismaWorkflowRunRepository(db);
const workflowCommandService = new WorkflowCommandService(workflowRepository);
const pipelineDispatcher = new ScreeningInsightPipelineDispatcher(
  workflowCommandService,
);
const executionService = new ScreeningExecutionService({
  sessionRepository,
  strategyRepository,
  pipelineDispatcher,
});

const workerId = process.env.SCREENING_WORKER_ID ?? `screening-worker-${randomUUID()}`;
const pollIntervalMs = env.SCREENING_WORKER_POLL_INTERVAL_MS;

let shuttingDown = false;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shutdown = async (signal: NodeJS.Signals) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.info(`[screening-worker] receive ${signal}, shutting down...`);
  await db.$disconnect();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

async function main() {
  console.info(`[screening-worker] started: ${workerId}`);

  while (!shuttingDown) {
    try {
      const recovered = await executionService.executeRecoverableRunningSession();
      if (recovered) {
        continue;
      }

      const picked = await executionService.executeNextPendingSession();
      if (!picked) {
        await sleep(pollIntervalMs);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(`[screening-worker] loop error: ${message}`);
      await sleep(pollIntervalMs);
    }
  }
}

void main();
