# LangGraph Agents 完整编码方案（2026-03-06）

## 1. 目标与范围

本方案用于在当前 T3 Stack + Python FastAPI 基线上，补齐需求文档中的 agents 能力，优先交付：

1. 固定 5-Agent 的快速行业研究工作流（可运行）
2. 异步执行（长任务不阻塞请求）
3. Redis 状态持久化 + 断点恢复基础能力
4. 前端可见的任务进度与结果
5. PostgreSQL 可审计的运行历史

不在本轮强制交付：

1. 完整的用户自定义 DAG 编辑器
2. 全量新闻/公告抓取生态
3. 复杂多租户配额与计费

---

## 2. 当前基线判断

当前仓库已具备：

1. `screening` 领域模型、仓储、tRPC 主链路
2. `watchlist` 能力与 Prisma 持久化
3. Python 服务的股票基础数据与历史指标接口

当前仓库缺失：

1. `workflow` / `intelligence` 上下文代码
2. LangGraph.js 编排层与 worker 运行时
3. Redis 与进度事件机制
4. Workflow 相关数据库模型
5. 前端工作流任务页面

---

## 3. 架构设计（最小可落地）

### 3.1 上下文与分层

1. 新增 `Workflow Context`：负责任务模板、任务运行、节点执行审计
2. 新增 `Investment Intelligence Context`：负责行业认知、可信度分析等业务语义
3. 保持 `Screening Context` 独立，Agent 3 通过应用层复用现有筛选能力

### 3.2 运行时拆分

1. `web`（Next.js）负责：创建任务、查询状态、展示结果、推送进度
2. `workflow-worker` 负责：执行 LangGraph、调用 LLM 与数据源、写入状态
3. Redis 负责：checkpoint 与进度 pub/sub
4. PostgreSQL 负责：模板、运行记录、节点记录、事件日志、最终报告

### 3.3 固定 5-Agent 图（第一版）

1. Agent 1：行业背景速览
2. Agent 2：市场热度分析
3. Agent 3：标的快速筛选（复用 screening）
4. Agent 4：真实性批量验证
5. Agent 5：竞争格局总结

---

## 4. 目录级落地清单

```text
src/server/
├── api/
│   └── routers/
│       └── workflow.ts                         # 新增
├── domain/
│   ├── workflow/                               # 新增
│   └── intelligence/                           # 新增
└── infrastructure/
    ├── workflow/                               # 新增
    │   └── langgraph/
    │       ├── graphs/
    │       └── nodes/
    └── intelligence/                           # 新增

src/app/
└── workflows/                                  # 新增
    ├── page.tsx
    └── [runId]/page.tsx

src/app/api/
└── workflows/runs/[runId]/events/route.ts      # 新增（SSE）

tooling/workers/
└── workflow-worker.ts                          # 新增

python_services/app/
├── routers/intelligence_data.py                # 新增
└── services/intelligence_data_adapter.py       # 新增
```

---

## 5. 文件级最小实现清单

## 5.1 数据模型（Prisma）

1. `prisma/schema.prisma`
2. `prisma/migrations/*`（自动生成）

新增模型：

1. `WorkflowTemplate`：模板定义与版本号
2. `WorkflowRun`：一次运行实例
3. `WorkflowNodeRun`：节点执行记录
4. `WorkflowEvent`：运行过程事件流

## 5.2 Domain（Workflow + Intelligence）

1. `src/server/domain/workflow/aggregates/workflow-run.ts`
2. `src/server/domain/workflow/enums/workflow-run-status.ts`
3. `src/server/domain/workflow/repositories/workflow-run-repository.ts`
4. `src/server/domain/workflow/repositories/workflow-template-repository.ts`
5. `src/server/domain/intelligence/repositories/research-data-repository.ts`

## 5.3 Infrastructure（仓储 + LangGraph + 外部服务）

1. `src/server/infrastructure/workflow/prisma-workflow-run-repository.ts`
2. `src/server/infrastructure/workflow/prisma-workflow-template-repository.ts`
3. `src/server/infrastructure/workflow/redis-client.ts`
4. `src/server/infrastructure/workflow/progress-publisher.ts`
5. `src/server/infrastructure/intelligence/deepseek-client.ts`
6. `src/server/infrastructure/intelligence/python-intelligence-data-client.ts`
7. `src/server/infrastructure/workflow/langgraph/state.ts`
8. `src/server/infrastructure/workflow/langgraph/graphs/quick-industry-research-graph.ts`
9. `src/server/infrastructure/workflow/langgraph/nodes/agent1-industry-overview.ts`
10. `src/server/infrastructure/workflow/langgraph/nodes/agent2-heat-analysis.ts`
11. `src/server/infrastructure/workflow/langgraph/nodes/agent3-candidate-screening.ts`
12. `src/server/infrastructure/workflow/langgraph/nodes/agent4-credibility-batch.ts`
13. `src/server/infrastructure/workflow/langgraph/nodes/agent5-competition-summary.ts`

## 5.4 API 与编排入口

1. `src/server/api/routers/workflow.ts`
2. `src/server/api/root.ts`（挂载 `workflow`）
3. `tooling/workers/workflow-worker.ts`
4. `package.json`（新增 `worker:workflow` 脚本）

tRPC 最小接口：

1. `workflow.start`
2. `workflow.getRun`
3. `workflow.listRuns`
4. `workflow.cancel`

## 5.5 Python 微服务扩展

1. `python_services/app/services/intelligence_data_adapter.py`
2. `python_services/app/routers/intelligence_data.py`
3. `python_services/app/main.py`（注册新 router）
4. `python_services/requirements.txt`（补依赖）

最小接口建议：

1. `GET /api/intelligence/news`
2. `GET /api/intelligence/announcements`
3. `GET /api/intelligence/evidence/{stockCode}`

## 5.6 前端最小可用页

1. `src/app/workflows/page.tsx`（创建任务 + 运行列表）
2. `src/app/workflows/[runId]/page.tsx`（进度、节点状态、结果）
3. `src/app/api/workflows/runs/[runId]/events/route.ts`（SSE）

## 5.7 配置与部署

1. `src/env.js`（新增 `REDIS_URL`、`DEEPSEEK_API_KEY`、`PYTHON_SERVICE_URL`）
2. `.env.example`（补模板）
3. `deploy/.env.example`（补部署变量）
4. `deploy/docker-compose.yml`（新增 `redis`、`workflow-worker`）
5. `README.md`（补运行方式）

## 5.8 测试

1. `src/server/infrastructure/workflow/__tests__/quick-industry-research-graph.test.ts`
2. `src/server/api/routers/__tests__/workflow.test.ts`
3. `src/server/infrastructure/intelligence/__tests__/deepseek-client.test.ts`
4. `python_services/tests/test_intelligence_data.py`

---

## 6. 关键状态机定义

`WorkflowRun.status`：

1. `PENDING`：已创建待执行
2. `RUNNING`：图执行中
3. `SUCCEEDED`：全部节点成功
4. `FAILED`：有节点失败且不可恢复
5. `CANCELLED`：用户主动取消

`WorkflowNodeRun.status`：

1. `PENDING`
2. `RUNNING`
3. `SUCCEEDED`
4. `FAILED`
5. `SKIPPED`

---

## 7. 两周最小落地节奏（建议）

### 第 1 周

1. 完成 Prisma 模型与迁移
2. 完成 `workflow.start/get/list/cancel` 接口骨架
3. 跑通 worker + Redis + checkpoint
4. 完成 Agent 1 + Agent 3 的最小图（2 节点验证链路）

### 第 2 周

1. 扩展到完整 5-Agent 固定图
2. 前端任务页与详情页接入
3. 增加失败重试与取消
4. 补齐最小测试集并完成验收

---

## 8. 验收标准（DoD）

1. 用户可在前端发起“快速了解某赛道”任务
2. 任务在后台异步执行，不阻塞请求
3. 前端可查看实时进度与节点状态
4. 任务完成后可查看结构化结果与候选标的
5. Worker 中断后可从 Redis checkpoint 恢复继续
6. 所有新增接口具备基础单测/集成测试

---

## 9. 第二阶段扩展（非本轮必做）

1. 模板可配置 DAG（用户定义节点顺序）
2. 模板版本迁移策略
3. 多数据源并行（iFinD + AkShare）
4. 成本/时延监控与预算保护
5. 批量可信度分析并发控制与配额

