# Docker Desktop 部署说明

本目录提供完整的 Docker Compose 编排，用于启动以下服务：

- `web`：Next.js 应用
- `python-service`：FastAPI 金融与情报数据网关
- `workflow-worker`：工作流执行器
- `screening-worker`：筛选任务执行器
- `redis`：运行时缓存与队列状态
- `postgres`：PostgreSQL 数据库

## 前置条件

- 已安装并启动 Docker Desktop
- `docker version` 与 `docker compose version` 可正常执行

## 1. 准备环境变量

先创建本地部署配置：

```bash
cp deploy/.env.example deploy/.env
```

最低必填项：

- `AUTH_SECRET`
- `POSTGRES_PASSWORD`
- `WEB_PORT` / `PYTHON_SERVICE_PORT` / `POSTGRES_PORT`

如需尽可能启用完整能力，建议同时配置：

- `DEEPSEEK_API_KEY`：启用工作流总结、Insight 归档等增强摘要能力
- `FIRECRAWL_API_KEY`：启用公司研究中的网页搜索与抓取
- `ZHIPU_API_KEY`：启用主题到概念映射的智谱 Web Search
- `IFIND_USERNAME` / `IFIND_PASSWORD`：启用 iFinD 作为主筛选数据源
- `REFCHECKER_*`：启用 RefChecker 可信度分析，而不是仅使用 heuristic fallback

## 2. 可选的 iFinD 厂商安装包

公共 PyPI 当前没有可直接安装的 `iFinDPy` 发行版，因此 Docker 不能仅靠公网依赖把 iFinD 跑起来。
如果你要在 Linux 容器内真正启用 iFinD，请把厂商提供的安装包放到：

```text
deploy/python/vendor/
```

支持的包格式：

- `*.whl`
- `*.tar.gz`
- `*.zip`

如果该目录中没有厂商包，Python 服务仍然可以正常构建，并按 `SCREENING_ENABLE_AKSHARE_FALLBACK`
退回到 AkShare。

## 3. 规则持久化

主题概念规则现在会持久化到 Docker 命名卷 `python_theme_rules_data`。
默认写入路径为：

```text
/data/theme-concept-rules/theme_concept_rules.json
```

如有需要，也可以通过 `INTELLIGENCE_THEME_CONCEPT_RULES_FILE` 覆盖该路径。

## 4. 启动服务

在仓库根目录执行：

```bash
docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d --build
```

启动后：

- `web` 会依次执行 `npm run validate:runtime`、`npm run db:push`、`npm run start`
- `workflow-worker` 会轮询并执行工作流任务
- `screening-worker` 会轮询并执行筛选任务

## 5. 访问地址

- Web：`http://localhost:3000`
- Python API Docs：`http://localhost:8000/docs`
- PostgreSQL：默认 `localhost:5432`，如果改了 `POSTGRES_PORT` 则以该端口为准

## 6. 常用命令

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

停止服务并删除数据卷：

```bash
docker compose --env-file deploy/.env -f deploy/docker-compose.yml down -v
```
