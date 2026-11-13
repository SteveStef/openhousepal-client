#!/usr/bin/env bash
# ONE-TIME setup of a fresh Ubuntu VPS as the Cinematic Video render server. Run as root (or with sudo):
#   MAIN_SERVER_IP=5.161.101.69 bash setup-server.sh
# Then copy the code with deploy.sh (from the frontend folder on a dev machine).
# Prints the worker token at the end: the main server needs VIDEO_WORKER_URL=http://<this ip>:8095
# and VIDEO_WORKER_TOKEN=<token> (Dokploy env).
set -euo pipefail
MAIN_SERVER_IP="${MAIN_SERVER_IP:?set MAIN_SERVER_IP to the main OpenHousePal server's IP}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
# Node 20 LTS
if ! command -v node >/dev/null || ! node -v | grep -qE '^v(2[0-9])'; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
# Libraries Remotion's headless Chrome needs (names differ between Ubuntu releases - try both)
apt-get install -y ca-certificates fonts-liberation libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libdrm2 libgbm1 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libpango-1.0-0 libcairo2 ufw unattended-upgrades
apt-get install -y libasound2t64 || apt-get install -y libasound2

# Service user + folders
id ohpvideo >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/ohpvideo --shell /usr/sbin/nologin ohpvideo
mkdir -p /opt/ohp-video /var/lib/ohp-video
chown -R ohpvideo:ohpvideo /opt/ohp-video /var/lib/ohp-video

# Shared secret (kept if it already exists)
if [ ! -f /etc/ohp-video-worker.env ]; then
  TOKEN="$(openssl rand -hex 32)"
  cat > /etc/ohp-video-worker.env <<EOF
VIDEO_WORKER_PORT=8095
VIDEO_WORKER_TOKEN=${TOKEN}
VIDEO_WORKER_GL=swangle
VIDEO_WORKER_DATA_DIR=/var/lib/ohp-video
EOF
  chmod 640 /etc/ohp-video-worker.env
  chown root:ohpvideo /etc/ohp-video-worker.env
fi

# Firewall: SSH from anywhere (key-only), the worker port ONLY from the main server
ufw allow 22/tcp
ufw allow from "${MAIN_SERVER_IP}" to any port 8095 proto tcp
ufw --force enable

# Security updates install themselves
dpkg-reconfigure -f noninteractive unattended-upgrades || true

install -m 644 "$(dirname "$0")/ohp-video-worker.service" /etc/systemd/system/ohp-video-worker.service
systemctl daemon-reload
systemctl enable ohp-video-worker

echo
echo "Setup done. Next: deploy the code (deploy.sh), then give the main server:"
echo "  VIDEO_WORKER_URL=http://$(curl -fsS https://api.ipify.org || hostname -I | awk '{print $1}'):8095"
echo "  VIDEO_WORKER_TOKEN=$(grep VIDEO_WORKER_TOKEN /etc/ohp-video-worker.env | cut -d= -f2)"
