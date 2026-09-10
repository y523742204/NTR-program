# NTR · 单打网球赛事小程序

NTR 是一个专注于**单打网球赛事**的微信小程序，采用「单打循环赛」与「单打淘汰赛」两种赛制，支持报名/候补、赛程自动生成、比分录入/确认/仲裁、排名榜单与淘汰对阵树。平台区分用户端与管理端：普通用户报名参赛，管理员发布并管理赛事。整体采用**浅色清新绿**主题。

## 功能特性

- **两种赛制**：单打循环赛（伯格轮转，灵活人数）、单打淘汰赛（小组赛 + 淘汰对阵树，可含三四名）
- **赛事发布**：选择赛制/等级/时间/地点/签位/比分规则，自动生成标题与卡片缩略图；发布后可随时编辑，保存自动更新
- **报名管理**：报名/候补、移除报名、赛事信息动态更新
- **赛程与比分**：一键生成赛程、球员录入比分、对手确认、管理员仲裁或标记未打
- **榜单与对阵**：实时排名榜单、淘汰赛对阵树
- **开发便捷**：本地开发支持控制台 `switchAccount(...)` 快速切换账号

## 技术栈

- 前端：Taro 4 + React 18 + TypeScript（微信小程序 / H5），图标使用 `@taroify/icons`
- 后端：NestJS 11 + Prisma 7 + PostgreSQL
- 工程化：pnpm workspace + turbo，Conventional Commits（commitlint / husky）

## 仓库结构

```text
apps/api        # NestJS API（登录、赛事、赛程、比分、榜单）
apps/mobile     # Taro 小程序（清新绿 UI）
packages/shared # 前后端共享类型与赛程算法
scripts/        # 开发环境切换等运维脚本
deploy/         # 服务器容器化部署（详见 deploy/README.md）
```

## 赛制与角色

| 赛制       | 说明                                                |
| ---------- | --------------------------------------------------- |
| 单打循环赛 | 灵活人数（默认 8 人），伯格轮转法，每人彼此交手一次 |
| 单打淘汰赛 | 标准 4~32 人，小组赛 + 淘汰对阵树（可含三四名）     |

比分规则支持 `6局抢7`、`4局抢7`、`1局决胜`；比分由球员录入、对手确认，管理员可仲裁或标记未打。

| 角色   | 能力                                                                |
| ------ | ------------------------------------------------------------------- |
| 用户   | 浏览赛事、报名/候补、查看赛程与榜单、录入并确认自场比分、查看战绩   |
| 管理员 | 发布/编辑赛事、生成与发布赛程、移除报名、仲裁比分、用户与管理员管理 |

## 环境准备

首次运行先安装依赖：

```bash
pnpm install
```

根目录创建 `.env`（参考 `.env.example`）：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ntr?schema=public"
API_PORT=3100
UPLOAD_ROOT="./uploads"
NTR_API_BASE_URL="http://127.0.0.1:3100"
WECHAT_APP_ID="wx633a36cd7c0e751f"
WECHAT_APP_SECRET=""
WECHAT_MINIPROGRAM_STATE="developer"
```

## 本地开发

### 1. 数据库

用 Docker 启动本地 PostgreSQL（`db:start`），或使用本机已运行的 Postgres：

```bash
pnpm db:start                      # docker compose 启动 postgres（默认 5432）
pnpm --filter @ntr/api exec prisma migrate dev --name init   # 初始化/同步数据库
pnpm --filter @ntr/api prisma:seed # 种子：管理员 13800000000 / 用户 13900000000
```

> 端口冲突时可修改 `.env` 的 `DATABASE_URL`，例如改用独立容器映射的 `localhost:5433`。

### 2. 启动 API

```bash
pnpm dev:api
```

健康检查：`GET http://127.0.0.1:3100/health` 返回 `{"status":"ok","service":"NTR",...}`。

### 3. 启动小程序

```bash
pnpm dev:mobile:local
```

在微信开发者工具中导入 `apps/mobile/dist/weapp` 目录。

- 本地开发登录：控制台执行 `switchAccount({ name: '测试', role: 'ADMIN' })` 快速切换账号。
- 真机调试：将 `dev:mobile:local` 的 API 地址改为局域网 IP（或直接改 `.env` 的 `NTR_API_BASE_URL`）。

## 常用命令

### 小程序三模式（local / test / prod）

pnpm dev:mobile:local # watch开发指向local的前端小程序
pnpm dev:mobile:test # watch开发指向test的前端小程序
pnpm dev:mobile:prod # watch开发指向prod的前端小程序
pnpm build:mobile:local # 编译指向local的前端小程序
pnpm build:mobile:test # 编译指向test的前端小程序
pnpm build:mobile:prod # 编译指向prod的前端小程序

`local` 指向本机 API，`test` / `prod` 分别指向远端测试 / 生产服务器。
每种模式均有 **watch（开发）** 与 **build（一次性构建）** 两种命令：

| model | API |
| local | `http://127.0.0.1:3100` |
| test | `https://test-server.nygtennis.club` |
| prod | `https://server.nygtennis.club` |

产物均输出到 `apps/mobile/dist/weapp`。

登录管理员账户通过：

### API 构建

```bash
pnpm --filter @ntr/api build   # 编译到 apps/api/dist
pnpm --filter @ntr/api start   # 运行 node dist/main.js（生产形态）
pnpm --filter @ntr/api test    # 运行单元测试
```

### 全仓常用命令

```bash
pnpm dev              # 并行启动 api + mobile watch
pnpm typecheck        # 全仓类型检查
pnpm lint             # 全仓 lint
pnpm format           # prettier 格式化
pnpm commit           # 符合 Conventional Commits 的提交
pnpm --filter @ntr/api test   # 运行 API 单元测试
```

### 数据库

```bash
pnpm db:start         # 启动 postgres（docker compose）
pnpm db:stop          # 停止 postgres
pnpm db:logs          # 查看 postgres 日志
pnpm db:migrate       # 生产迁移：prisma migrate deploy
pnpm --filter @ntr/api prisma:migrate   # 开发迁移：prisma migrate dev
pnpm --filter @ntr/api prisma:generate  # 生成 Prisma Client
pnpm --filter @ntr/api prisma:studio    # 打开 Prisma Studio
```

### 部署与环境切换

```bash
./scripts/switch-dev-env.sh remote|local [--full]   # 一键切换测试/本地开发环境
pnpm deploy:api:test     # 发布后端到测试环境
pnpm deploy:api:prod     # 发布后端到生产环境（仅接受 origin/master 提交）
```

部署细节见 `deploy/README.md`。
