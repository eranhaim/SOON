#!/usr/bin/env sh
# Run on the server from the repo root: sh deploy/deploy.sh
set -eu

git pull --ff-only
docker compose -f deploy/docker-compose.prod.yml up -d --build
docker image prune -f >/dev/null
docker compose -f deploy/docker-compose.prod.yml ps
