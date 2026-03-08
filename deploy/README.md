# Docker Desktop 部署说明（WSL）

本目录提供一个完整的 Docker Compose 项目，统一编排以下容器：

- `web`：Next.js（T3 Stack）主应用
- `python-service`：FastAPI + AkShare 数据服务
- `workflow-worker`：LangGraph 工作流异步执行 Worker
- `screening-worker`：筛选任务异步执行 Worker（最新改动）
- `redis`：任务与缓存中间件
- `postgres`：PostgreSQL

## 1. 前置条件

- Windows 已安装并启动 Docker Desktop
- Docker Desktop 已开启当前 WSL 发行版集成（Settings -> Resources -> WSL Integration）
- 在 WSL 中可执行 `docker version`

## 2. 配置环境变量

在项目根目录执行：

```bash
cp deploy/.env.example deploy/.env
```

至少修改 `deploy/.env` 中的：

- `AUTH_SECRET`
- `POSTGRES_PASSWORD`
- `DEEPSEEK_API_KEY`（如果需要运行工作流智能推理）

如果你当前 WSL/Windows 已有服务占用 `3000`、`8000`、`5432`，请同时调整：

- `WEB_PORT`
- `PYTHON_SERVICE_PORT`
- `POSTGRES_PORT`

`deploy/.env.example` 已包含 worker 所需变量，重点包括：

- `WORKFLOW_WORKER_POLL_INTERVAL_MS`
- `SCREENING_WORKER_POLL_INTERVAL_MS`
- `PYTHON_SERVICE_URL`
- `PYTHON_INTELLIGENCE_SERVICE_URL`
- `REDIS_URL`

## 3. 启动（在 WSL 内执行）

在项目根目录执行：

```bash
docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d --build
```

首次启动后，`web` 容器会自动执行 `npm run db:push`，将 Prisma schema 同步到 `postgres`。
`workflow-worker` 与 `screening-worker` 会自动启动并轮询待处理任务。

## 4. 访问地址

- Web: `http://localhost:3000`
- Python API docs: `http://localhost:8000/docs`
- PostgreSQL: `localhost:5432`

## 5. 常用运维命令

查看日志：

```bash
docker compose --env-file deploy/.env -f deploy/docker-compose.yml logs -f
```

仅查看筛选 Worker 日志：

```bash
docker compose --env-file deploy/.env -f deploy/docker-compose.yml logs -f screening-worker
```

查看容器状态：

```bash
docker compose --env-file deploy/.env -f deploy/docker-compose.yml ps
```

停止并移除容器（保留数据库卷）：

```bash
docker compose --env-file deploy/.env -f deploy/docker-compose.yml down
```

停止并移除容器与数据库卷（会清空数据库）：

```bash
docker compose --env-file deploy/.env -f deploy/docker-compose.yml down -v
```
