#!/bin/bash
# deploy/deploy.sh — One-command deploy to fitsenseai.aidhunik.com
# Run this on your server after cloning the repo

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOMAIN="fitsenseai.aidhunik.com"

echo "🚀 Deploying RepSensei to $DOMAIN..."

# 1. Pull latest code
cd "$PROJECT_DIR"
git pull origin main

# 2. Check optional env vars (core features work without any API keys)
if [ -z "$GEMINI_API_KEY" ]; then
  echo "⚠️  GEMINI_API_KEY not set — coaching will use template fallbacks (still works great!)"
fi

# 3. Build and start containers
docker compose down --remove-orphans
docker compose up -d --build

# 4. Wait for backend health
echo "Waiting for backend to be healthy..."
for i in {1..30}; do
  if curl -s http://localhost:4000/health | grep -q '"ok"'; then
    echo "✅ Backend is healthy"
    break
  fi
  sleep 2
done

# 5. Copy nginx config if not already linked
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
if [ ! -f "$NGINX_CONF" ]; then
  sudo cp "$PROJECT_DIR/deploy/nginx-fitsenseai.conf" "$NGINX_CONF"
  sudo ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/$DOMAIN"
  echo "Nginx config installed. Run: sudo certbot --nginx -d $DOMAIN"
fi

# 6. Reload nginx
sudo nginx -t && sudo systemctl reload nginx

echo "✅ RepSensei deployed at https://$DOMAIN"
