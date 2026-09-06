#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DEPLOY_HOST="${ntr_DEPLOY_HOST:-root@106.54.95.88}"
DEPLOY_KEY="${ntr_DEPLOY_SSH_KEY:-$HOME/.ssh/ntr_tencent}"
RELEASE_DIR="$ROOT_DIR/.cache/releases"
SCOPED_PATHS=(
  Dockerfile
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml
  tsconfig.base.json
  turbo.json
  apps/api
  packages/shared
)
SSH_OPTIONS=(-i "$DEPLOY_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)

log() {
  printf '[ntr] %s\n' "$*"
}

fail() {
  printf '[ntr] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null || fail "missing command: $1"
}

main() {
  local dirty
  local tag
  local archive_name
  local checksum_name

  cd "$ROOT_DIR"
  for command in docker git gzip pnpm scp shasum ssh; do
    require_command "$command"
  done

  dirty=$(git status --porcelain -- "${SCOPED_PATHS[@]}")
  [[ -z "$dirty" ]] || {
    printf '%s\n' "$dirty" >&2
    fail 'commit backend, shared, lockfile, or Docker changes before deployment'
  }

  [[ -f "$DEPLOY_KEY" ]] || fail "SSH key not found: $DEPLOY_KEY"
  docker info >/dev/null 2>&1 || fail 'Docker Desktop is not running'

  tag=$(git rev-parse --short=12 HEAD)
  archive_name="ntr-${tag}-backend.tar.gz"
  checksum_name="${archive_name}.sha256"
  mkdir -p "$RELEASE_DIR"

  log "validating backend release $tag"
  pnpm --filter @ntr/shared build
  pnpm --filter @ntr/api typecheck
  pnpm --filter @ntr/api test
  pnpm --filter @ntr/api build

  log 'building Linux/AMD64 images'
  docker buildx build \
    --platform linux/amd64 \
    --target runtime \
    --tag "ntr-api:$tag" \
    --load \
    .
  docker buildx build \
    --platform linux/amd64 \
    --target migration \
    --tag "ntr-migrate:$tag" \
    --load \
    .

  log "creating $archive_name"
  docker save "ntr-api:$tag" "ntr-migrate:$tag" |
    gzip -1 >"$RELEASE_DIR/$archive_name"
  (
    cd "$RELEASE_DIR"
    shasum -a 256 "$archive_name" >"$checksum_name"
  )

  log "preparing release storage on $DEPLOY_HOST"
  scp "${SSH_OPTIONS[@]}" \
    "$ROOT_DIR/deploy/remote-release.sh" \
    "$DEPLOY_HOST:/root/ntr-remote-release"
  ssh "${SSH_OPTIONS[@]}" "$DEPLOY_HOST" \
    'chmod 700 /root/ntr-remote-release && /root/ntr-remote-release cleanup'

  log "uploading release to $DEPLOY_HOST"
  scp "${SSH_OPTIONS[@]}" \
    "$RELEASE_DIR/$archive_name" \
    "$RELEASE_DIR/$checksum_name" \
    "$DEPLOY_HOST:/root/"

  log 'deploying test environment'
  ssh "${SSH_OPTIONS[@]}" "$DEPLOY_HOST" \
    "chmod 700 /root/ntr-remote-release && /root/ntr-remote-release test '$tag' '/root/$archive_name' '/root/$checksum_name'"

  log "release $tag deployed to https://test-server.mojiekj.com"
  log 'production promotion only accepts a tested origin/master release: pnpm deploy:api:prod'
}

main "$@"
