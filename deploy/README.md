# Docker Desktop 部署说明

本目录提供一套完整的 Docker Compose 编排，用于启动以下服务：

- `web`：Next.js 主站
- `python-service`：FastAPI 金融数据服务
- `workflow-worker`：LangGraph 工作流异步执行 Worker
- `screening-worker`：筛选任务异步执行 Worker
- `redis`：运行时事件与缓存
- `postgres`：PostgreSQL 数据库

## 1. 前置条件

- 已安装并启动 Docker Desktop
- 如果你在 WSL 中执行命令，Docker Desktop 已开启对应发行版的 WSL Integration
- 可正常执行 `docker version` 与 `docker compose version`

## 2. 环境配置

首次部署前，复制环境文件：

```bash
cp deploy/.env.example deploy/.env
```

至少检查以下变量：

- `AUTH_SECRET`
- `POSTGRES_PASSWORD`
- `WEB_PORT` / `PYTHON_SERVICE_PORT` / `POSTGRES_PORT`

如果你希望“公司研究任务中心”真正调用 Firecrawl 抓取网页证据，请额外配置：

- `FIRECRAWL_API_KEY`
- `FIRECRAWL_BASE_URL`（默认 `https://api.firecrawl.dev`）
- `FIRECRAWL_TIMEOUT_MS`（默认 `15000`）

如果你希望工作流中的总结与结构化整理使用 DeepSeek，请配置：

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`

说明：

- 未配置 `FIRECRAWL_API_KEY` 时，公司研究流仍可运行，但会退化为“生成研究框架 + 待核验问题”，不会抓取网页证据。
- 未配置 `DEEPSEEK_API_KEY` 时，系统会使用内置 fallback 文本与结构，不会阻塞任务执行。

## 3. 启动服务

在项目根目录执行：

```bash
docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d --build
```

启动后：

- `web` 会先执行 `npm run db:push`，再启动 Next.js
- `workflow-worker` 会自动轮询并执行行业/公司研究任务
- `screening-worker` 会自动轮询筛选任务

## 4. 访问地址

- Web：`http://localhost:3000`
- Python API Docs：`http://localhost:8000/docs`
- PostgreSQL：`localhost:5432`

## 5. 常用命令

查看全部日志：

```bash
docker compose --env-file deploy/.env -f deploy/docker-compose.yml logs -f
```

查看工作流 Worker 日志：

```bash
docker compose --env-file deploy/.env -f deploy/docker-compose.yml logs -f workflow-worker
```

查看容器状态：

```bash
docker compose --env-file deploy/.env -f deploy/docker-compose.yml ps
```

停止服务：

```bash
docker compose --env-file deploy/.env -f deploy/docker-compose.yml down
```

停止并清空数据库卷：

```bash
docker compose --env-file deploy/.env -f deploy/docker-compose.yml down -v
```
