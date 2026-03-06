# LangGraph Agents 编码上下文（精简版，2026-03-06）

> 目的：给 coding agent 提供“足够开工”的上下文。
> 已删减：逐文件样板签名、可由类型系统直接推导的重复细节、过度展开的实现模板。

## 1. 本轮目标与边界

### 1.1 必须交付

1. 固定 5-Agent 的快速行业研究工作流可运行
2. 异步执行（tRPC 快速返回，Worker 后台处理）
3. Redis checkpoint + 事件推送（支持恢复与实时进度）
4. 前端可查看运行状态、节点状态、最终报告
5. PostgreSQL 保存审计记录（run / node / event）

### 1.2 本轮不做

1. 用户自定义 DAG 编辑器
2. 多租户配额与计费
3. 多数据源扩展（先 AkShare + DeepSeek）

## 2. 必须遵守的架构约束

1. DDD 分层：`domain -> application -> infrastructure`
2. 上下文边界：`screening` 与 `intelligence` 不直接互调，由 `workflow` 应用层编排
3. 双存储：
   - PostgreSQL：模板/运行/节点/事件（最终真相）
   - Redis：checkpoint + 进度分发
4. 进程分离：
   - `web`：接收请求、创建 run、查询 run
   - `workflow-worker`：轮询并执行 LangGraph
5. 对外入口：
   - 应用 API：tRPC
   - 实时流：Next Route Handler SSE

## 3. 端到端行为（判定正确性的主流程）

1. 前端调用 `workflow.startQuickResearch`
2. Web 创建 `WorkflowRun(PENDING)`，初始化必要 Node/Event
3. Worker 领取 `PENDING`，标记 `RUNNING`
4. 执行 5 节点图；每节点落库 NodeRun/Event，并发布 Redis 进度
5. SSE 订阅 Redis channel，将事件推送前端
6. 成功：`WorkflowRun(SUCCEEDED)` + 结构化结果；失败：`FAILED`
7. Worker 异常重启后可从 checkpoint 恢复

## 4. 最小目录落点

```text
src/server/
  api/routers/workflow.ts
  application/workflow/{command,query,execution}-service.ts
  application/intelligence/intelligence-agent-service.ts
  application/screening/screening-facade.ts
  domain/workflow/*
  domain/intelligence/*
  infrastructure/workflow/{prisma,redis,langgraph}/*
  infrastructure/intelligence/{deepseek-client,python-intelligence-data-client}.ts

src/app/
  workflows/page.tsx
  workflows/[runId]/page.tsx
  api/workflows/runs/[runId]/events/route.ts

tooling/workers/workflow-worker.ts

python_services/app/
  routers/intelligence_data.py
  services/intelligence_data_adapter.py
```

## 5. 数据模型（Prisma 最小契约）

### 5.1 枚举

- `WorkflowRunStatus`: `PENDING | RUNNING | SUCCEEDED | FAILED | CANCELLED`
- `WorkflowNodeRunStatus`: `PENDING | RUNNING | SUCCEEDED | FAILED | SKIPPED`
- `WorkflowEventType`:
  - `RUN_CREATED | RUN_STARTED | RUN_CANCEL_REQUESTED | RUN_CANCELLED | RUN_SUCCEEDED | RUN_FAILED`
  - `NODE_STARTED | NODE_PROGRESS | NODE_SUCCEEDED | NODE_FAILED`

### 5.2 模型

1. `WorkflowTemplate`
- 关键字段：`code`、`version`、`graphConfig`、`inputSchema`、`isActive`
- 约束：`@@unique([code, version])`

2. `WorkflowRun`
- 关键字段：`templateId`、`userId`、`query`、`input`、`status`、`progressPercent`、`currentNodeKey`
- 恢复字段：`checkpointKey`、`cancellationRequestedAt`
- 结果字段：`result`、`errorCode`、`errorMessage`
- 时间字段：`startedAt`、`completedAt`、`createdAt`、`updatedAt`

3. `WorkflowNodeRun`
- 关键字段：`runId`、`nodeKey`、`agentName`、`attempt`、`status`
- 审计字段：`input`、`output`、`errorCode`、`errorMessage`、`durationMs`
- 约束：`@@unique([runId, nodeKey, attempt])`

4. `WorkflowEvent`
- 关键字段：`runId`、`nodeRunId`、`sequence`、`eventType`、`payload`、`occurredAt`
- 约束：`@@unique([runId, sequence])`

## 6. 业务契约（coding agent 需要实现的最小接口）

### 6.1 tRPC（`workflow` router）

1. `startQuickResearch`
- 输入：`query`、`templateCode=quick_industry_research`、`templateVersion?`、`idempotencyKey?`
- 输出：`{ runId, status: "PENDING", createdAt }`

2. `getRun`
- 输入：`runId`
- 输出：run 详情（基础字段 + nodes + failure/result）

3. `listRuns`
- 输入：`limit`、`cursor?`、`status?`
- 输出：run 列表

4. `cancelRun`
- 输入：`runId`
- 输出：`{ success: true }`

### 6.2 Worker 执行服务

- `executeNextPendingRun(workerId)`：领取并执行一个任务，返回是否领取成功
- 任务执行时负责：状态迁移、节点落库、事件落库、进度发布、失败处理、取消检查、checkpoint

### 6.3 SSE 路由

- 路径：`/api/workflows/runs/[runId]/events`
- 鉴权：先 `auth()`，再 `getRun({ userId, runId })` 做权限校验
- 订阅 channel：`workflow:run:{runId}:events`
- 事件最小结构：

```ts
{
  runId: string;
  sequence: number;
  type: "RUN_STARTED" | "NODE_STARTED" | "NODE_PROGRESS" | "NODE_SUCCEEDED" | "NODE_FAILED" | "RUN_SUCCEEDED" | "RUN_FAILED" | "RUN_CANCELLED";
  nodeKey?: string;
  progressPercent: number;
  timestamp: string;
  payload: Record<string, unknown>;
}
```

### 6.4 Python FastAPI（AkShare 适配）

1. `GET /api/intelligence/news?theme&days&limit`
2. `GET /api/intelligence/evidence/{stock_code}?concept`
3. `POST /api/intelligence/evidence/batch`

返回结构需匹配 TS 侧 `ThemeNewsItem` 与 `CompanyEvidence`。

## 7. LangGraph 固定工作流

### 7.1 节点顺序（固定）

1. `agent1_industry_overview`
2. `agent2_market_heat`
3. `agent3_candidate_screening`
4. `agent4_credibility_batch`
5. `agent5_competition_summary`

### 7.2 状态最小字段

- 输入态：`runId`、`userId`、`query`
- 中间态：`intent`、`industryOverview`、`heatAnalysis`、`candidates`、`credibility`、`competition`
- 输出态：`finalReport`
- 运行态：`currentNodeKey`、`progressPercent`、`errors[]`

### 7.3 最终结果（`QuickResearchResultDto`）

- `overview`
- `heatScore` + `heatConclusion`
- `candidates[]`
- `credibility[]`
- `topPicks[]`
- `competitionSummary`
- `generatedAt`

## 8. 可靠性策略（必须）

### 8.1 错误码

- `WORKFLOW_TEMPLATE_NOT_FOUND`
- `WORKFLOW_RUN_NOT_FOUND`
- `WORKFLOW_RUN_FORBIDDEN`
- `WORKFLOW_INVALID_STATUS_TRANSITION`
- `WORKFLOW_NODE_EXECUTION_FAILED`
- `WORKFLOW_CANCEL_NOT_ALLOWED`
- `INTELLIGENCE_DATA_UNAVAILABLE`
- `INTELLIGENCE_LLM_PARSE_FAILED`

### 8.2 幂等

- `startQuickResearch` 支持 `idempotencyKey`
- 规则：`userId + idempotencyKey` 在 `PENDING/RUNNING` 已存在时返回已有 `runId`

### 8.3 恢复

1. 每个节点成功后保存 checkpoint：`workflow:checkpoint:{runId}`
2. Worker 启动时优先恢复 `RUNNING` 且存在 checkpoint 的 run
3. 节点执行前后都检查取消标记，及时停止并写 `RUN_CANCELLED`

## 9. 最小实施顺序

### 阶段 A：先打通链路

1. Prisma 枚举/模型/迁移
2. Workflow Command/Query + tRPC `start/get/list/cancel`
3. Worker 轮询 + 领取执行
4. 先接通 Agent1 + Agent3 验证闭环

### 阶段 B：补齐能力

1. Agent2/4/5
2. Redis progress bus + SSE
3. 前端详情页实时展示
4. Python intelligence 路由与 TS client 打通
5. 回归失败、取消、恢复路径

## 10. DoD（完成判定）

1. 可发起“快速了解某赛道”并立即拿到 `runId`
2. tRPC 启动接口返回时间 `< 2s`（异步执行）
3. 前端可实时看到节点状态变化
4. 完成后可查看结构化报告
5. Worker 重启后可继续执行未完成 run
6. 至少通过：`npm run typecheck`、关键 TS 测试、`python -m pytest`

## 11. 给 coding agent 的执行提示

1. 先保证“可跑通”再细化质量，不要先做可视化增强
2. 优先保持接口稳定（tRPC/SSE/Python），内部实现可迭代
3. 严格遵守 DDD 边界：domain 不依赖基础设施实现
