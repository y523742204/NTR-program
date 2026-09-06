#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

DEPLOY_DIR="${ntr_DEPLOY_DIR:-/opt/ntr}"
DATA_DIR="${ntr_DATA_DIR:-/data/ntr}"
IMAGE_ENV="$DEPLOY_DIR/images.env"
COMPOSE_FILE="$DEPLOY_DIR/compose.yaml"
COMPOSE=(docker compose --env-file "$IMAGE_ENV" -f "$COMPOSE_FILE")
RELEASE_RETENTION_COUNT=5
MIN_RELEASE_FREE_MB=5120

log() {
  printf '[ntr] %s\n' "$*"
}

fail() {
  printf '[ntr] ERROR: %s\n' "$*" >&2
  exit 1
}

require_file() {
  [[ -f "$1" ]] || fail "missing file: $1"
}

validate_tag() {
  [[ "$1" =~ ^[0-9a-f]{7,40}$ ]] || fail "invalid release tag: $1"
}

assert_image_architecture() {
  local image="$1"
  local platform
  platform=$(docker image inspect "$image" --format '{{.Os}}/{{.Architecture}}')
  [[ "$platform" == 'linux/amd64' ]] || fail "$image has unexpected platform: $platform"
}

update_image() {
  local key="$1"
  local image="$2"
  grep -q "^${key}=" "$IMAGE_ENV" || fail "$key is missing from $IMAGE_ENV"
  sed -i "s#^${key}=.*#${key}=${image}#" "$IMAGE_ENV"
  grep -qx "${key}=${image}" "$IMAGE_ENV" || fail "failed to update $key"
}

release_tag_from_env() {
  local key="$1"
  local image

  image=$(sed -n "s/^${key}=//p" "$IMAGE_ENV")
  [[ "$image" =~ ^ntr-api:([0-9a-f]{7,40})$ ]] ||
    fail "invalid $key in $IMAGE_ENV: $image"
  printf '%s\n' "${BASH_REMATCH[1]}"
}

is_protected_tag() {
  local candidate="$1"
  local protected

  shift
  for protected in "$@"; do
    [[ "$candidate" == "$protected" ]] && return 0
  done
  return 1
}

cleanup_release_images() {
  local -a protected_tags
  local -a removal_refs=()
  local api_inventory
  local image_tags
  local repository
  local tag
  local prod_tag
  local test_tag
  local recent_count=0

  prod_tag=$(release_tag_from_env PROD_IMAGE)
  test_tag=$(release_tag_from_env TEST_IMAGE)
  docker image inspect "ntr-api:$prod_tag" "ntr-api:$test_tag" >/dev/null
  protected_tags=("$prod_tag" "$test_tag")
  api_inventory=$(docker image ls ntr-api --format '{{.CreatedAt}}|{{.Tag}}' | sort -r)
  while IFS='|' read -r _ tag; do
    [[ "$tag" =~ ^[0-9a-f]{7,40}$ ]] || continue
    protected_tags+=("$tag")
    recent_count=$((recent_count + 1))
    [[ "$recent_count" -ge "$RELEASE_RETENTION_COUNT" ]] && break
  done <<<"$api_inventory"

  for repository in ntr-api ntr-migrate; do
    image_tags=$(docker image ls "$repository" --format '{{.Tag}}')
    while IFS= read -r tag; do
      [[ "$tag" =~ ^[0-9a-f]{7,40}$ ]] || continue
      is_protected_tag "$tag" "${protected_tags[@]}" && continue
      removal_refs+=("$repository:$tag")
    done <<<"$image_tags"
  done

  log "removing ${#removal_refs[@]} ntr image tags outside the protected ${RELEASE_RETENTION_COUNT}-release window"
  [[ ${#removal_refs[@]} -eq 0 ]] || docker image rm "${removal_refs[@]}" >/dev/null
}

assert_release_space() {
  local available_mb

  available_mb=$(df -Pm "$DEPLOY_DIR" | awk 'NR == 2 {print $4}')
  [[ "$available_mb" =~ ^[0-9]+$ ]] || fail 'failed to determine available disk space'
  [[ "$available_mb" -ge "$MIN_RELEASE_FREE_MB" ]] ||
    fail "only ${available_mb}MB is available; ${MIN_RELEASE_FREE_MB}MB is required"
  log "release storage is ready: ${available_mb}MB available"
}

prepare_release_storage() {
  cleanup_release_images
  assert_release_space
}

wait_for_health() {
  local container="$1"
  local port="$2"
  local response

  for _ in $(seq 1 30); do
    if response=$(curl -fsS "http://127.0.0.1:${port}/health" 2>/dev/null); then
      printf '%s\n' "$response"
      return 0
    fi
    sleep 2
  done

  docker logs --tail 100 "$container" >&2 || true
  return 1
}

restore_service() {
  local backup="$1"
  local service="$2"
  log "health check failed; restoring previous application image"
  /bin/cp "$backup" "$IMAGE_ENV"
  "${COMPOSE[@]}" up -d --no-deps "$service" || true
}

load_release() {
  local tag="$1"
  local archive="$2"
  local checksum="$3"
  local archive_dir

  require_file "$archive"
  require_file "$checksum"
  [[ "$(basename "$archive")" == "ntr-${tag}-backend.tar.gz" ]] ||
    fail "archive name does not match release tag"
  [[ "$checksum" == "${archive}.sha256" ]] || fail "unexpected checksum path"

  archive_dir=$(dirname "$archive")
  (
    cd "$archive_dir"
    sha256sum -c "$(basename "$checksum")"
  )
  gzip -dc "$archive" | docker load
  assert_image_architecture "ntr-api:$tag"
  assert_image_architecture "ntr-migrate:$tag"
  rm -f -- "$archive" "$checksum"
}

deploy_test() {
  local tag="$1"
  local archive="$2"
  local checksum="$3"
  local backup="$DEPLOY_DIR/images.env.before-$tag"

  prepare_release_storage
  load_release "$tag" "$archive" "$checksum"
  [[ -f "$backup" ]] || /bin/cp -a "$IMAGE_ENV" "$backup"

  log "applying test database migrations"
  # Docker 20.10.1's default seccomp profile blocks Node 22 worker threads.
  docker run --rm \
    --network ntr-net \
    --env-file /etc/ntr/test-migrate.env \
    --security-opt no-new-privileges:true \
    --security-opt seccomp=unconfined \
    "ntr-migrate:$tag"

  update_image TEST_IMAGE "ntr-api:$tag"
  "${COMPOSE[@]}" config >/dev/null
  "${COMPOSE[@]}" up -d --no-deps api-test

  if ! wait_for_health ntr-api-test 13100; then
    restore_service "$backup" api-test
    fail "test release failed"
  fi

  cleanup_release_images
  log "test release $tag is healthy: https://test-server.mojiekj.com"
}

backup_production_database() {
  local tag="$1"
  local backup_dir="$DATA_DIR/backups"
  local backup="$backup_dir/ntr_prod_${tag}_$(date +%Y%m%d_%H%M%S).dump"

  mkdir -p "$backup_dir"
  chmod 700 "$backup_dir"
  log "creating production database backup: $backup"

  if ! docker exec ntr-postgres \
    pg_dump -U ntr_admin -d ntr_prod --format=custom >"$backup"; then
    rm -f -- "$backup"
    fail "production database backup failed"
  fi

  [[ -s "$backup" ]] || fail "production database backup is empty"
  docker exec -i ntr-postgres pg_restore --list <"$backup" >/dev/null
  chmod 600 "$backup"
  printf '%s\n' "$backup"
}

deploy_prod() {
  local tag="$1"
  local image="ntr-api:$tag"
  local backup="$DEPLOY_DIR/images.env.before-prod-$tag"
  local test_image

  prepare_release_storage
  assert_image_architecture "$image"
  assert_image_architecture "ntr-migrate:$tag"
  test_image=$(sed -n 's/^TEST_IMAGE=//p' "$IMAGE_ENV")
  [[ "$test_image" == "$image" ]] ||
    fail "production can only promote the current tested image ($test_image)"

  backup_production_database "$tag"
  [[ -f "$backup" ]] || /bin/cp -a "$IMAGE_ENV" "$backup"

  log "applying production database migrations"
  # Docker 20.10.1's default seccomp profile blocks Node 22 worker threads.
  docker run --rm \
    --network ntr-net \
    --env-file /etc/ntr/prod-migrate.env \
    --security-opt no-new-privileges:true \
    --security-opt seccomp=unconfined \
    "ntr-migrate:$tag"

  update_image PROD_IMAGE "$image"
  "${COMPOSE[@]}" config >/dev/null
  "${COMPOSE[@]}" up -d --no-deps api-prod

  if ! wait_for_health ntr-api-prod 13000; then
    restore_service "$backup" api-prod
    fail "production release failed; database backup was preserved"
  fi

  cleanup_release_images
  log "production release $tag is healthy: https://server.mojiekj.com"
}

main() {
  local action="${1:-}"
  local tag="${2:-}"

  require_file "$IMAGE_ENV"
  require_file "$COMPOSE_FILE"
  case "$action" in
    cleanup)
      [[ $# -eq 1 ]] || fail 'usage: remote-release.sh cleanup'
      prepare_release_storage
      ;;
    test)
      [[ $# -eq 4 ]] || fail 'usage: remote-release.sh test TAG ARCHIVE CHECKSUM'
      validate_tag "$tag"
      deploy_test "$tag" "$3" "$4"
      ;;
    prod)
      [[ $# -eq 2 ]] || fail 'usage: remote-release.sh prod TAG'
      validate_tag "$tag"
      deploy_prod "$tag"
      ;;
    *)
      fail 'action must be cleanup, test, or prod'
      ;;
  esac
}

main "$@"
