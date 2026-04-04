#!/bin/bash
echo "==> Pushing to GitHub..."
git add . && git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M')" && git push

echo "==> Deploying to VPS..."
ssh ubuntu@198.100.155.231 << 'ENDSSH'
  set -e
  cd ~/pixeltec-os
  git pull origin main
  docker compose --env-file .env.production build
  docker compose --env-file .env.production up -d
  echo "==> Health check:"
  sleep 3
  curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost
ENDSSH
