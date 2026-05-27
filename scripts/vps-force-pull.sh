#!/bin/sh
# Force VPS tree to match GitHub main (discards local edits to tracked files).
set -e
cd "$(dirname "$0")/.."

echo "==> Fetching origin/main..."
git fetch origin main

echo "==> Resetting to origin/main (hard)..."
git reset --hard origin/main

echo "==> Done. HEAD=$(git rev-parse --short HEAD)"
git log -1 --oneline
