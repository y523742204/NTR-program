# NTR · 单打网球赛事小程序

NTR 是一个专注于**单打网球赛事**的微信小程序，采用「单循环」与「小组赛+淘汰赛」两种赛制，支持报名、赛程自动生成、比分录入/确认/仲裁、结算榜单与淘汰对阵树。平台区分用户端与管理端：普通用户报名参赛，管理员发布并管理赛事。

技术栈：Taro 4 + React 18 + TypeScript（小程序/H5）、NestJS 11 + Prisma 7 + PostgreSQL、pnpm workspace + turbo。

## 目录

```text
apps/api        # NestJS API（微信手机号登录、赛事、单打赛程、比分、榜单）
apps/mobile     # Taro 小程序（暗色竞技风 UI）
packages/shared # 前后端共享类型与赛程算法（单循环/分组/淘汰）
```

## 本地调试

首次运行先安装依赖：

```bash
pnpm install
```

### 本地 API

需要本地 PostgreSQL（默认 `postgres:postgres@localhost:5432/ntr`）。可直接使用本机已运行的 Postgres，创建 `ntr` 数据库后执行迁移与种子：

```bash
# 初始化数据库结构
pnpm --filter @ntr/api exec prisma migrate dev --name init
# 生成 Prisma Client 并启动 API
pnpm --filter @ntr/api prisma:generate
pnpm dev:api
```

种子脚本会创建管理员（手机号 `13800000000`）与测试用户（`13900000000`）。

### 启动小程序

另开终端：

```bash
pnpm dev:mobile
```

在微信开发者工具中导入 `apps/mobile` 目录，项目配置使用 `project.config.json`。

- 开发登录：控制台可执行 `switchAccount({ name: '测试', role: 'ADMIN' })` 快速切换账号（仅开发环境）。
- 生产版 WeChat AppID / AppSecret 需在根目录 `.env` 中配置 `WECHAT_APP_ID` / `WECHAT_APP_SECRET`，并在 `apps/mobile/project.config.json` 中替换为你的小程序 `appid`。

## 赛制

- **单循环**：灵活人数（默认 8 人），伯格轮转法保证每人彼此交手一次。
- **小组+淘汰**：标准 4~32 人，小组赛 + 淘汰赛对阵树（可含三四名）。小组赛全部结束后自动按名次落位淘汰赛首轮。

比分规则支持 `6局抢7`、`4局抢7`、`1局决胜`；比分由球员录入，对手确认，管理员可仲裁或标记未打。

## 角色

| 角色   | 能力                                                                     |
| ------ | ------------------------------------------------------------------------ |
| 用户   | 浏览赛事、报名/候补、查看赛程与榜单、录入并确认自场比分、查看战绩        |
| 管理员 | 发布/编辑/取消赛事、生成与发布赛程、移除报名、仲裁比分、用户与管理员管理 |

## 常用命令

```bash
pnpm dev            # 并行启动 api + mobile watch
pnpm typecheck      # 全仓类型检查
pnpm lint           # 全仓 lint
pnpm build          # 全仓构建
pnpm commit         # 符合 Conventional Commits 的提交
pnpm db:migrate     # 生产迁移：prisma migrate deploy
```
