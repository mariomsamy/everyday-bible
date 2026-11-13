#!/usr/bin/env bash
# One-command setup on any Linux/macOS server with Node >= 22.5:  bash deploy/install.sh
set -euo pipefail
cd "$(dirname "$0")/.."

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1"; exit 1; }; }
need node; need npm
major=$(node -p "process.versions.node.split('.')[0]"); minor=$(node -p "process.versions.node.split('.')[1]")
if [ "$major" -lt 22 ] || { [ "$major" -eq 22 ] && [ "$minor" -lt 5 ]; }; then echo "Node >= 22.5 required (found $(node -v))"; exit 1; fi

if [ ! -f .env ]; then
  token=$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")
  cp .env.example .env
  sed -i.bak "s|^ADMIN_TOKEN=.*|ADMIN_TOKEN=$token|" .env && rm -f .env.bak
  echo "Created .env with a random ADMIN_TOKEN (your admin password). Read it with: grep ADMIN_TOKEN .env"
  echo "Edit .env: PUBLIC_URL, TRUST_PROXY=1 behind a proxy, HOST=0.0.0.0 only if you expose it directly."
fi

echo "Building the app..."
(cd app && npm ci && npm run build)

if [ "${1:-}" = "--texts" ]; then node scripts/fetch-texts.mjs; else echo "Bible texts: run 'npm run texts' (all, ~670 MB) or 'node scripts/fetch-texts.mjs ar_kehm en_web'. Without them the app falls back to a public CDN."; fi
echo "Done. Start with: npm start   (or use deploy/bible.service for systemd)"
