#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DEPLOY_HOST="${ntr_DEPLOY_HOST:-root@106.54.95.88}"
DEPLOY_KEY="${ntr_DEPLOY_SSH_KEY:-$HOME/.ssh/ntr_tencent}"
SSH_OPTIONS=(-i "$DEPLOY_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)

fail() {
  printf '[ntr] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null || fail "missing command: $1"
}

get_master_release_tag() {
  local branch
  local dirty
  local local_commit
  local remote_commit

  branch=$(git branch --show-current)
  [[ "$branch" == 'master' ]] || fail "production releases must run from master, not $branch"
  dirty=$(git status --porcelain -- deploy/remote-release.sh scripts/promote-api-prod.sh)
  [[ -z "$dirty" ]] || fail 'production deployment scripts must be committed before release'
  git fetch origin
  local_commit=$(git rev-parse HEAD)
  remote_commit=$(git rev-parse --verify origin/master)
  [[ "$local_commit" == "$remote_commit" ]] ||
    fail 'local master must exactly match origin/master before production release'
  git rev-parse --short=12 "$remote_commit"
}

main() {
  local master_tag
  local test_image
  local tag
  local confirmation

  cd "$ROOT_DIR"
  for command in git scp ssh; do
    require_command "$command"
  done
  [[ -f "$DEPLOY_KEY" ]] || fail "SSH key not found: $DEPLOY_KEY"
  master_tag=$(get_master_release_tag)

  test_image=$(ssh "${SSH_OPTIONS[@]}" "$DEPLOY_HOST" \
    "sed -n 's/^TEST_IMAGE=//p' /opt/ntr/images.env")
  [[ "$test_image" =~ ^ntr-api:([0-9a-f]{7,40})$ ]] ||
    fail "unexpected test image: $test_image"
  tag="${BASH_REMATCH[1]}"
  [[ "$tag" == "$master_tag" ]] ||
    fail "tested image $tag is not origin/master $master_tag; deploy master to test first"
  [[ -t 0 ]] || fail 'production promotion requires an interactive terminal'

  printf '即将把 master 的已验证测试版本 %s 发布到生产。\n' "$tag"
  printf '请输入版本号 %s 确认: ' "$tag"
  read -r confirmation
  [[ "$confirmation" == "$tag" ]] || fail 'production promotion cancelled'

  scp "${SSH_OPTIONS[@]}" \
    "$ROOT_DIR/deploy/remote-release.sh" \
    "$DEPLOY_HOST:/root/ntr-remote-release"
  ssh "${SSH_OPTIONS[@]}" "$DEPLOY_HOST" \
    "chmod 700 /root/ntr-remote-release && /root/ntr-remote-release prod '$tag'"

  printf '[ntr] production release %s completed\n' "$tag"
}

main "$@"
