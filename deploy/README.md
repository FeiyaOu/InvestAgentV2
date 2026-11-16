# 部署：阿里云 ECS + Docker Compose + GitHub Actions

```text
GitHub main ─push─▶ Actions: test → build api/web 镜像 → push ACR ─ssh─▶ ECS: docker compose pull && up -d
                                                                      ├─ web   nginx：静态前端 + /api 反代（SSE 不缓冲）
                                                                      ├─ api   FastAPI（alembic upgrade head 后启动）
                                                                      └─ postgres 业务表 + LangGraph checkpoint
```

ECS 只从同地域的 ACR 拉镜像，不访问 GitHub 和 Docker Hub。没有域名时用 `http://<ECS IP>:<WEB_PORT>` 访问，
只有 HTTP；有域名备案后在 web 前加证书即可，其余不变。

## 一、ECS 初始化（一次）

Ubuntu 22.04 / Alibaba Cloud Linux 3，2 vCPU 4 GB。安全组放开 22 与 `WEB_PORT`（默认 80）。

```bash
# 1) Docker（阿里云镜像源）
curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://mirrors.aliyun.com/docker-ce/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER && newgrp docker

# 2) 应用目录与配置
sudo mkdir -p /opt/investagent && sudo chown $USER /opt/investagent && cd /opt/investagent
# 把仓库里的 deploy/.env.example 复制为 /opt/investagent/.env 并填好：
#   POSTGRES_PASSWORD、INVEST_JWT_SECRET（openssl rand -base64 48）、DASHSCOPE_API_KEY、WEB_PORT
#   API_IMAGE / WEB_IMAGE 先随意填，CI 每次部署会改写成当前镜像 tag

# 3) 登录 ACR（个人版免费，开通后创建命名空间，设置固定密码）
docker login registry.cn-hangzhou.aliyuncs.com -u <ACR 用户名>
```

## 二、GitHub 仓库 Secrets

| Secret | 值 |
|---|---|
| ACR_REGISTRY | 如 `registry.cn-hangzhou.aliyuncs.com`（与 ECS 同地域） |
| ACR_NAMESPACE | ACR 命名空间 |
| ACR_USERNAME / ACR_PASSWORD | ACR 访问凭证 |
| ECS_HOST | ECS 公网 IP |
| ECS_USER | 登录用户（如 `ubuntu` / `root`） |
| ECS_SSH_KEY | 对应用户的私钥全文（建议专门生成一对，公钥加入 `~/.ssh/authorized_keys`） |
| ECS_SSH_PORT | 可选，默认 22 |
| ECS_APP_DIR | 可选，默认 `/opt/investagent` |

在仓库 Settings → Environments 新建 `production`，可加 required reviewers 做人工确认再部署。

## 三、首次部署

推送到 main 或在 Actions 页手动运行 Deploy。流程：测试 → 构建推送两个镜像（tag 为 commit 短 SHA 与 latest）→
scp 最新 `docker-compose.yml` 到 ECS → 改写 `.env` 中的镜像 tag → `docker compose pull && up -d` → 健康检查。

部署会等待容器健康（最多 180 秒），再通过 web 实际映射的端口检查 `/api/health`；
检查失败时输出 API 与 web 日志并将部署标记为失败。

部署成功后打开 `http://<ECS IP>:<WEB_PORT>`，注册你的账号，然后在 ECS 上把 `.env` 的
`INVEST_ALLOW_REGISTRATION` 改为 `false` 并执行 `docker compose up -d api`。
这只关闭新账号注册；首页和访客研究仍可使用，访客数据不进入账号数据库。

## 四、日常运维

```bash
cd /opt/investagent
docker compose ps                         # 状态
docker compose logs -f api                # API 日志（含 alembic 输出）
docker compose exec postgres pg_dump -U investagent investagent | gzip > backup-$(date +%F).sql.gz
docker compose exec api alembic current   # 当前 schema 版本
```

回滚：把 `.env` 的 API_IMAGE / WEB_IMAGE 改回上一个 tag，`docker compose up -d`。

## 五、本地验证同一套编排

API 镜像只安装 `backend/requirements-api.txt`；本地完整开发仍安装
`backend/requirements.txt`（包含 Streamlit 与离线评估工具）。Docker 构建保留 pip 下载缓存，
下载超时为 120 秒，失败后重试时可复用已下载的包。

```bash
cp deploy/.env.example deploy/.env   # 填 DASHSCOPE_API_KEY、随机密码；WEB_PORT 可改 8080
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.build.yml --env-file deploy/.env up -d --build
open http://localhost:8080
```

## 变更数据库结构

改 `backend/api/models.py` 后：`cd backend && alembic revision --autogenerate -m "..."`，检查生成的脚本并提交。
容器启动时自动 `alembic upgrade head`。checkpoint 表由 LangGraph 自行管理，迁移脚本已排除。

## 本地验收记录（2026-11-15）

- API / Web 镜像构建成功，Postgres / API / Web 三个容器健康，本地端口 8080。
- Postgres 初始迁移成功，`alembic check` 无模型差异。
- 经 nginx 验证注册、登录、用户信息、真实研究执行、SSE 事件回放。
- 真实报告生成并通过校验，Markdown / HTML 下载成功；替换 API 容器后仍可登录、读取记录、回放事件和下载报告。
- 全新对话的第二轮追问正确引用上一轮股票名称与代码。旧会话中包含失败回答时，模型仍可能额外要求澄清。
- 后端 552 项单元测试通过（2 项 integration 未运行），Ruff / 结构检查通过；前端此前 6 项测试与生产构建通过。

这次验收覆盖本地 Docker 与 HTTP 接口，尚未在 ECS / ACR 执行部署，也未做浏览器交互验收。
