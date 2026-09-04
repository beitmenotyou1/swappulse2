#!/usr/bin/env bash

# Resolve a tagged official Madara image to an immutable digest for lab use.
# Stage-A must not benchmark a mutable :latest tag. The default candidate is a
# post-shutdown-hardening prerelease; operators can override it explicitly with
# MADARA_DISCOVERY_TAG for a later reviewed tag.

HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
IMAGE_TAG="${MADARA_DISCOVERY_TAG:-ghcr.io/madara-alliance/madara:v0.11.0-alpha.9}"
OUT="$HERE/.env.image"

printf '=== pulling reviewed Madara candidate image ===\n'
printf 'tag: %s\n' "$IMAGE_TAG"
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
