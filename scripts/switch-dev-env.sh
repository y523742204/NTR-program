#!/usr/bin/env bash
#
# switch-dev-env.sh — ntr 开发环境一键切换（远端测试环境 / 本地环境）
#
# 用法:
#   ./scripts/switch-dev-env.sh remote              # 切到远端测试环境（配置 + SSH 隧道）
#   ./scripts/switch-dev-env.sh local               # 切到本地环境（配置 + 本地库检查）
#   ./scripts/switch-dev-env.sh remote --full       # 切换后自动重启 API、重新编译小程序
#   ./scripts/switch-dev-env.sh remote --dry-run    # 只打印将执行的步骤，不实际执行
#
# 模板文件（含数据库连接串，已被 .gitignore 忽略，勿提交）:
#   .env.local.remote   -> 远端测试库 ntr_test（经 5433 隧道）
#   .env.local.local    -> 本地库 ntr（127.0.0.1:5432）
# 切换前自动把当前 .env.local 备份为 .env.local.bak-<时间戳>。
#
# --full 额外流程:
#   1) 停止本项目 API/小程序进程并等待 3000 端口释放
#   2) 轮转 .dev-logs/api.log（时间戳备份只保留最近 5 份）
#   3) 在 API watcher 启动前生成 Prisma Client（避免运行中整包重写触发重启竞态）
#   4) 启动 API 并做健康检查，重新编译小程序后再做一次最终确认
#
# 环境变量:
#   LOCAL_API_URL  本地环境小程序 API 地址（默认 http://127.0.0.1:3000，真机调试改为局域网 IP）

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TARGET=""
FULL=0
DRY_RUN=0
LOCAL_API_URL="${LOCAL_API_URL:-http://127.0.0.1:3000}"

for arg in "$@"; do
  case "$arg" in
    --full) FULL=1 ;;
    --dry-run) DRY_RUN=1 ;;
    remote|local) TARGET="$arg" ;;
    *) echo "错误: 未知参数 '$arg'" >&2; exit 1 ;;
  esac
done

if [ -z "$TARGET" ]; then
  echo "用法: ./scripts/switch-dev-env.sh <remote|local> [--full] [--dry-run]" >&2
  exit 1
fi

say()  { printf '\n\033[1;36m[switch]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[ok]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }

# 执行命令；--dry-run 时只打印
run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '\033[1;34m[run]\033[0m %s\n' "$*"
    return 0
  fi
  "$@"
}

# 1) 切换 .env.local
TPL=".env.local.$TARGET"
if [ ! -f "$TPL" ]; then
  echo "错误: 模板文件 $TPL 不存在" >&2
  exit 1
fi
say "切换 .env.local -> $TPL"
if cmp -s .env.local "$TPL"; then
  ok ".env.local 已是目标配置，无需修改"
else
  BAK=".env.local.bak-$(date +%Y%m%d-%H%M%S)"
  run cp .env.local "$BAK"
  run cp "$TPL" .env.local
  ok "已备份旧配置到 ${BAK}，写入 $TPL"
fi

# 2) 基础设施
if [ "$TARGET" = "remote" ]; then
  say "确保 SSH 隧道（127.0.0.1:5433 -> 腾讯云测试库）"
  if nc -z -G 3 127.0.0.1 5433 >/dev/null 2>&1; then
    ok "5433 隧道已存在"
  else
    run ssh -fN -L 127.0.0.1:5433:172.29.240.2:5432 \
      -i ~/.ssh/ntr_tencent -o BatchMode=yes \
      -o StrictHostKeyChecking=accept-new root@106.54.95.88
    sleep 2
  fi
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '\033[1;34m[plan]\033[0m 验证 5433 隧道连通（nc -z 127.0.0.1 5433）\n'
  elif nc -z -G 3 127.0.0.1 5433 >/dev/null 2>&1; then
    ok "隧道验证通过（5433）"
  else
    warn "5433 隧道未就绪，请检查 SSH 密钥/网络后重试"
  fi
else
  say "确保本地 PostgreSQL（127.0.0.1:5432/ntr）"
  if pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
    ok "本地库已在运行"
  else
    run docker compose up -d postgres
    sleep 3
  fi
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '\033[1;34m[plan]\033[0m 验证本地库连通（pg_isready -h 127.0.0.1 -p 5432）\n'
  elif pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
    ok "本地库验证通过（5432）"
  else
    warn "本地库未就绪，请确认 Colima/Docker 已启动"
  fi
fi

# 3) --full: 重启 API + 重新编译小程序
if [ "$FULL" -eq 1 ]; then
  say "停止本地 API 与小程序 watch（仅匹配本项目进程）"
  # 同时覆盖 pnpm 父进程、nest watcher 与 node dist/main 子进程
  API_PATTERN='ntr-program/apps/api|@ntr/api dev|nest start|apps/api/dist/main'
  API_PIDS="$(pgrep -f "$API_PATTERN" 2>/dev/null || true)"
  WATCH_PIDS="$(pgrep -f '@tarojs/cli/bin/taro.*--watch|taro build.*--watch' 2>/dev/null || true)"
  if [ -n "$API_PIDS" ]; then
    run kill -TERM $API_PIDS
  fi
  if [ -n "$WATCH_PIDS" ]; then
    run kill -TERM $WATCH_PIDS
  fi

  # 等待 3000 释放；仍有残留则强杀，避免新旧 watcher 抢同一 dist/端口
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '\033[1;34m[plan]\033[0m 等待端口 3000 释放并清理残留 API 进程\n'
  else
    sleep 2
    for _ in 1 2 3 4 5; do
      nc -z -G 1 127.0.0.1 3000 >/dev/null 2>&1 || break
      sleep 1
    done
    if nc -z -G 1 127.0.0.1 3000 >/dev/null 2>&1; then
      warn "3000 端口仍被占用，强制结束残留 API 进程"
      REMAIN_PIDS="$(pgrep -f "$API_PATTERN" 2>/dev/null || true)"
      if [ -n "$REMAIN_PIDS" ]; then
        run kill -KILL $REMAIN_PIDS
      fi
      sleep 2
    fi
  fi

  # 轮转旧日志（保留一份时间戳备份），避免长期累积到几十 MB
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '\033[1;34m[plan]\033[0m 轮转 .dev-logs/api.log（若存在）\n'
  elif [ -s .dev-logs/api.log ]; then
    ROTATED=".dev-logs/api.log.$(date +%Y%m%d-%H%M%S)"
    mv .dev-logs/api.log "$ROTATED"
    ok "旧日志已轮转至 $ROTATED"
  fi

  # 只保留最近 5 份轮转备份（时间戳定长，字典序即时间序）
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '\033[1;34m[plan]\033[0m 清理 .dev-logs/api.log.* 备份（保留最近 5 份）\n'
  else
    STALE_BACKUPS="$(ls -1 .dev-logs/api.log.[0-9]* 2>/dev/null | sort -r | tail -n +6)"
    if [ -n "$STALE_BACKUPS" ]; then
      run rm -f $STALE_BACKUPS
      ok "已清理旧日志备份（保留最近 5 份）"
    fi
  fi
  mkdir -p .dev-logs

  # 在 watcher 启动前完成 Prisma Client 生成，避免运行中整包重写触发重启竞态
  say "生成 Prisma Client（watcher 启动前）"
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '\033[1;34m[run]\033[0m pnpm --filter @ntr/api prisma:generate\n'
  else
    pnpm --filter @ntr/api prisma:generate
  fi

  say "启动本地 API（watch 模式，日志 .dev-logs/api.log）"
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '\033[1;34m[run]\033[0m nohup pnpm --filter @ntr/api dev >> .dev-logs/api.log 2>&1 &\n'
  else
    nohup pnpm --filter @ntr/api dev >> .dev-logs/api.log 2>&1 &
    ok "API 已启动（pid $!），等待健康检查..."
    sleep 8
    if curl -s -m 5 http://127.0.0.1:3000/health >/dev/null 2>&1; then
      ok "API 健康检查通过（http://127.0.0.1:3000/health）"
    else
      warn "首次健康检查未通过，再等待 8s 重试（watch 首次编译可能较慢）"
      sleep 8
      if curl -s -m 5 http://127.0.0.1:3000/health >/dev/null 2>&1; then
        ok "API 健康检查通过（http://127.0.0.1:3000/health）"
      else
        printf '\n\033[1;31m[error]\033[0m API 健康检查未通过，最近日志：\n' >&2
        tail -n 40 .dev-logs/api.log >&2
        exit 1
      fi
    fi
  fi

  say "重新编译小程序（一次性构建）"
  if [ "$TARGET" = "remote" ]; then
    run pnpm build:mobile:dev
  else
    run env NTR_API_BASE_URL="$LOCAL_API_URL" pnpm --filter @ntr/mobile build
  fi
  if [ "$DRY_RUN" -eq 0 ]; then
    URLS="$(rg -o 'https?://[a-zA-Z0-9.\-]+(:[0-9]+)?' apps/mobile/dist/weapp/common.js 2>/dev/null | sort -u | tr '\n' ' ')"
    ok "小程序产物 API 地址: ${URLS:-未知}"
    # 最终确认：覆盖 nest watch 偶发重启崩溃的窗口
    if curl -s -m 5 http://127.0.0.1:3000/health >/dev/null 2>&1; then
      ok "API 最终确认正常（http://127.0.0.1:3000/health）"
    else
      printf '\n\033[1;31m[error]\033[0m API 在小程序构建期间退出，最近日志：\n' >&2
      tail -n 40 .dev-logs/api.log >&2
      exit 1
    fi
  fi
fi

say "切换完成"
echo ""
echo "下一步："
if [ "$TARGET" = "remote" ]; then
  echo "  1. 微信开发者工具重新编译（产物指向 https://test-server.mojiekj.com）"
  echo "  2. 如需 watch 模式: pnpm dev:mobile:test"
else
  echo "  1. 微信开发者工具重新编译（产物指向 ${LOCAL_API_URL}）"
  echo "  2. 如需 watch 模式: pnpm dev:mobile:local（真机）或 pnpm dev:mobile（本机开发者工具）"
fi
echo "  3. 模板与备份含连接串，已加入 .gitignore，请勿提交"
