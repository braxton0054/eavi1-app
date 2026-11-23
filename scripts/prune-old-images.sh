#!/usr/bin/env bash
# Remove stale eavi-portal images.
#
# Runs at the end of a successful deploy. It deliberately does NOT call
# `docker image prune -a`: this host runs several unrelated compose projects,
# and a blanket prune would delete their images too. Only image tags belonging
# to this repo are considered.
#
# Safety rules:
#   - keep the newest KEEP_IMAGES app tags and KEEP_IMAGES migrate tags
#   - never remove a tag referenced by any container (running or stopped)
#   - never touch images from other projects or base images
set -euo pipefail

REPO="${IMAGE_REPO:-ghcr.io/braxton0054/eavi1-app}"
KEEP="${KEEP_IMAGES:-2}"
LEGACY_IMAGES=(
  "eavi-portal:latest"
  "eavi-portal-migrate:latest"
  "eavi-portal-build:latest"
)

# 'docker ps -a' covers stopped containers too, e.g. the one-shot migrate job.
in_use="$(docker ps -a --format '{{.Image}}' | sort -u)"

is_in_use() {
  printf '%s\n' "$in_use" | grep -Fxq -- "$1"
}

removed=0

remove_if_safe() {
  local image="$1"
  if is_in_use "$image"; then
    echo "skip $image (referenced by a container)"
    return 0
  fi
  if docker rmi "$image" >/dev/null 2>&1; then
    echo "removed $image"
    removed=$((removed + 1))
  else
    echo "warning: could not remove $image" >&2
  fi
}

# Full 40-char SHA tags published by release.yml. Newest first.
prune_family() {
  local prefix="$1"
  local match="${REPO}:${prefix}"
  local kept=0
  local tag suffix

  while IFS='|' read -r _created tag; do
    case "$tag" in
      "$match"*) suffix="${tag#"$match"}" ;;
      *) continue ;;
    esac
    [[ "$suffix" =~ ^[0-9a-f]{40}$ ]] || continue

    if [ "$kept" -lt "$KEEP" ]; then
      kept=$((kept + 1))
      continue
    fi
    remove_if_safe "$tag"
  done < <(docker images --format '{{.CreatedAt}}|{{.Repository}}:{{.Tag}}' | sort -r)
}

prune_family ""
prune_family "migrate-"

# Images from the old build-on-the-box setup are no longer used by compose.
for image in "${LEGACY_IMAGES[@]}"; do
  if docker image inspect "$image" >/dev/null 2>&1; then
    remove_if_safe "$image"
  fi
done

echo "pruned ${removed} stale image(s); keeping ${KEEP} release(s) per family"
