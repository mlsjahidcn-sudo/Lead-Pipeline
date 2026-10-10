#!/usr/bin/env bash
# Hostinger VPS deploy hook. Invoked by the GitHub webhook (or manually).
# Idempotent: safe to re-run on every push.
#
# Prereqs installed once on the VPS (see DEPLOY_HOSTINGER.md section 1):
#   - bash 4+ on a Debian/Ubuntu VPS
#   - bun on PATH                (see DEPLOY_HOSTINGER.md section 1)
#   - pm2 on PATH                (see DEPLOY_HOSTINGER.md section 1)
#   - a checked-out repo at APP_DIR
#   - a populated .env with NEON vars at APP_DIR/.env
#
# Usage:
#   APP_DIR=/var/www/lead-pipeline ./deploy.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/lead-pipeline}"
APP_NAME="${APP_NAME:-crm}"
BRANCH="${BRANCH:-main}"
LOG_DIR="${LOG_DIR:-/var/log/lead-pipeline}"

mkdir -p "$LOG_DIR"

echo "[deploy] $(date -Iseconds) start  app=$APP_DIR  branch=$BRANCH"

# 1. Fetch and fast-forward. --ff-only refuses to clobber local commits or
#    fall back to a merge, keeping the working tree predictable.
cd "$APP_DIR"
echo "[deploy] git pull --ff-only origin $BRANCH"
if ! git pull --ff-only origin "$BRANCH"; then
  echo "[deploy] nothing to pull (or non-fast-forward — refusing to clobber)."
  exit 0
fi

# 2. Install deps from the frozen lockfile.
echo "[deploy] bun install --frozen-lockfile"
bun install --frozen-lockfile

# 3. Build the SPA. The API process serves dist/ in production.
echo "[deploy] bun run build"
bun run build

# 4. Run migrations if the repo ships one.
if [ -f server/migrate.ts ]; then
  echo "[deploy] bun run migrate"
  bun run migrate
fi

# 5. Reload under PM2 (zero-downtime if already running; first start otherwise).
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  echo "[deploy] pm2 reload $APP_NAME"
  pm2 reload "$APP_NAME" --update-env >> "$LOG_DIR/deploy.log" 2>&1
else
  echo "[deploy] pm2 start ecosystem.config.cjs"
  pm2 start ecosystem.config.cjs --only "$APP_NAME" --update-env >> "$LOG_DIR/deploy.log" 2>&1
fi

pm2 save --quiet

echo "[deploy] OK $(date -Iseconds)  HEAD=$(git rev-parse HEAD)"
