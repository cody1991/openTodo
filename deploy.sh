#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "===== OpenTodo Deploy ====="
echo "Root: $ROOT_DIR"

# 1. Pull latest code
echo "[1/5] Pulling latest code..."
git pull

# 2. Install backend dependencies
echo "[2/5] Installing server dependencies..."
cd "$ROOT_DIR/server" && npm install --production

# 3. Install & build frontend
echo "[3/5] Building frontend..."
# Ensure swap is active to avoid OOM on low-memory servers
if [ ! -f /swapfile ]; then
  echo "  [swap] Creating 1G swapfile..."
  fallocate -l 1G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=1024
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo "  [swap] Swap enabled."
fi
cd "$ROOT_DIR/client" && npm install && npm run build

# 4. Create required directories
echo "[4/5] Ensuring directories exist..."
mkdir -p "$ROOT_DIR/logs" "$ROOT_DIR/data/uploads"

# 5. Reload PM2 (or start if not running)
echo "[5/5] Reloading PM2 processes..."
cd "$ROOT_DIR"
if pm2 list | grep -q "opentodo-server"; then
  pm2 reload ecosystem.config.js
else
  pm2 start ecosystem.config.js
fi
pm2 save

echo ""
echo "===== Deploy complete! ====="
echo "Server running on port 3000"
