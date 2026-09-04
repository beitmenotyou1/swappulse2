#!/usr/bin/env bash

# Resolve the current official Madara image to an immutable digest for lab use.
# Pulling :latest is allowed only as the discovery step. The Compose lab then
# uses the resolved ghcr.io/...@sha256:... value from .env.image.

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
IMAGE_TAG="ghcr.io/madara-alliance/madara:latest"
OUT="$HERE/.env.image"

printf '=== pulling current official Madara image ===\n'
if ! docker pull "$IMAGE_TAG"; then
  printf 'Failed to pull %s\n' "$IMAGE_TAG"
  exit 1
fi

DIGEST="$(docker image inspect "$IMAGE_TAG" --format '{{range .RepoDigests}}{{println .}}{{end}}' 2>/dev/null \
  | grep '^ghcr.io/madara-alliance/madara@sha256:' \
  | head -n1)"

if [ -z "$DIGEST" ]; then
  printf 'Could not resolve an immutable RepoDigest for %s\n' "$IMAGE_TAG"
  exit 1
fi

printf 'MADARA_IMAGE=%s\n' "$DIGEST" > "$OUT"
chmod 0644 "$OUT"

printf '\nPinned Madara image:\n%s\n' "$DIGEST"
printf '\nWrote %s\n' "$OUT"

printf '\n=== image identity ===\n'
docker image inspect "$DIGEST" --format 'Id={{.Id}} Created={{.Created}} Architecture={{.Architecture}} Os={{.Os}}' 2>/dev/null || true
