#!/usr/bin/env bash
#
# start-dev.sh — 一键启动本地开发环境（API + 小程序编译）
#
# 用法:
#   ./start-dev.sh              # 启动并监控两个进程
#   ./start-dev.sh --no-monitor # 仅启动，不监控日志
#   DATABASE_URL=postgresql://... ./start-dev.sh # 显式指定其他数据库
#
# 按 Ctrl+C 停止所有进程。

set -euo pipefail
IFS=$'\n\t'

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# ── 配置 ──────────────────────────────────────────────
ENV_FILE="$ROOT/.env.local"
DATABASE_URL_OVERRIDE="${DATABASE_URL:-}"

LOG_DIR="$ROOT/.dev-logs"
API_LOG="$LOG_DIR/api.log"
MOBILE_LOG="$LOG_DIR/mobile.log"
MONITOR="${1:-}"

# ── 颜色 ──────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ── 清理函数 ──────────────────────────────────────────
cleanup() {
  echo ""
  echo -e "${YELLOW}正在停止所有进程...${NC}"
  # kill 整个进程组，确保子进程也被清理
  kill -- "-$$" 2>/dev/null || true
  wait 2>/dev/null || true
  echo -e "${GREEN}已停止${NC}"
}
trap cleanup EXIT SIGINT SIGTERM

# ── 准备 ──────────────────────────────────────────────
mkdir -p "$LOG_DIR"
# 清空旧日志
: > "$API_LOG"
: > "$MOBILE_LOG"

# 检查 pnpm
if ! command -v pnpm &>/dev/null; then
  echo -e "${RED}错误: 未找到 pnpm，请先安装${NC}"
  exit 1
fi

# 默认使用项目根目录 .env.local；外部传入 DATABASE_URL 时优先生效
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi
if [[ -n "$DATABASE_URL_OVERRIDE" ]]; then
  export DATABASE_URL="$DATABASE_URL_OVERRIDE"
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "错误: DATABASE_URL 未配置，请先创建 $ENV_FILE 或设置 DATABASE_URL" >&2
  exit 1
fi

# ── 构建产物 ──────────────────────────────────────────
echo -e "${CYAN}[0/2]${NC} 构建共享包和 Prisma client ..."
pnpm --filter @ntr/shared build
pnpm --filter @ntr/api prisma:generate

# ── 启动 API ──────────────────────────────────────────
echo -e "${CYAN}[1/2]${NC} 启动 API 服务 (port 3000) ..."
DATABASE_URL="$DATABASE_URL" pnpm --filter @ntr/api dev >"$API_LOG" 2>&1 &
API_PID=$!
echo -e "  ${GREEN}✓${NC} PID: $API_PID"

# ── 启动小程序编译 ────────────────────────────────────
echo -e "${CYAN}[2/2]${NC} 启动小程序前端编译 ..."
pnpm --filter @ntr/mobile dev:weapp >"$MOBILE_LOG" 2>&1 &
MOBILE_PID=$!
echo -e "  ${GREEN}✓${NC} PID: $MOBILE_PID"

# 等一会让进程产生初始输出
sleep 3

# ── 状态概览 ──────────────────────────────────────────
echo ""
echo -e "${CYAN}===== 状态概览 =====${NC}"
printf "  %-10s PID: %-6s Log: %s\n" "API" "$API_PID" "$API_LOG"
printf "  %-10s PID: %-6s Log: %s\n" "Mobile" "$MOBILE_PID" "$MOBILE_LOG"
echo ""

# ── 检查进程存活 ──────────────────────────────────────
check_alive() {
  local pid=$1 name=$2
  if ! kill -0 "$pid" 2>/dev/null; then
    echo -e "${RED}[!] $name 进程已退出${NC}"
    tail -5 "$([ "$name" = "API" ] && echo "$API_LOG" || echo "$MOBILE_LOG")" | sed 's/^/  /'
    return 1
  fi
  return 0
}

# ── 监控模式 ──────────────────────────────────────────
if [ "$MONITOR" = "--no-monitor" ]; then
  echo -e "${YELLOW}仅启动模式，等待中... (Ctrl+C 停止)${NC}"
  wait
  exit 0
fi

echo -e "${CYAN}===== 实时日志 (Ctrl+C 停止) =====${NC}"
echo -e "${YELLOW}提示: 异常行会以 [ERR] 标记${NC}"
echo ""

# 同时 tail 两个日志文件
tail -f "$API_LOG" "$MOBILE_LOG" &
TAIL_PID=$!

# 主监控循环——扫描日志中的异常关键词
ERROR_PATTERNS="(Error|ERROR|Exception|Failed|failure|Cannot|拒绝连接|ECONNREFUSED|EADDRINUSE|unhandled|rejected|崩溃)"
SEEN_FILE="$LOG_DIR/.seen_errors"
: > "$SEEN_FILE"

while true; do
  # 检查进程
  check_alive "$API_PID" "API" || break
  check_alive "$MOBILE_PID" "Mobile" || break

  # 扫描日志中的错误行（每行只报告一次）
  for log in "$API_LOG" "$MOBILE_LOG"; do
    [ ! -s "$log" ] && continue
    name="api"
    [ "$log" = "$MOBILE_LOG" ] && name="mobile"

    grep -E "$ERROR_PATTERNS" "$log" 2>/dev/null | while IFS= read -r line; do
      [ -z "$line" ] && continue
      fingerprint=$(printf '%s' "$line" | head -c 80)
      if ! grep -qF "$fingerprint" "$SEEN_FILE" 2>/dev/null; then
        printf '%s\n' "$fingerprint" >> "$SEEN_FILE"
        echo -e "${RED}[ERR][$name]${NC} $line"
      fi
    done
  done

  sleep 3
done
