#!/usr/bin/env bash
# Build and tag the vg-email-sidecar image as carlsmig/vg-email-sidecar:<git sha> and :latest.
# Usage:
#   ./build.sh          build and tag only
#   ./build.sh --push   build, tag, and push both tags to Docker Hub
#
# CI (.github/workflows/publish-docker.yml) is the normal publisher: every push
# to main builds and pushes these same tags. Use --push only in an emergency,
# e.g. when Actions is unavailable.
# Override the repo with IMAGE, e.g. IMAGE=tvcri/vg-email-sidecar ./build.sh
set -euo pipefail

cd "$(dirname "$0")"

IMAGE=${IMAGE:-carlsmig/vg-email-sidecar}
SHA=$(git rev-parse --short HEAD)

if ! git diff-index --quiet HEAD --; then
  echo "warning: working tree has uncommitted changes; image content may not match ${SHA}" >&2
fi

docker build \
  --label "org.opencontainers.image.revision=$(git rev-parse HEAD)" \
  -t "${IMAGE}:${SHA}" -t "${IMAGE}:latest" .

echo "Built ${IMAGE}:${SHA} and ${IMAGE}:latest"

if [[ "${1:-}" == "--push" ]]; then
  docker push "${IMAGE}:${SHA}"
  docker push "${IMAGE}:latest"
  echo "Pushed ${IMAGE}:${SHA} and ${IMAGE}:latest"
fi
