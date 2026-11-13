#!/usr/bin/env bash
# Copy the Cinematic Video worker to the render server and restart it. Run from the FRONTEND folder:
#   bash video-worker/deploy/deploy.sh ubuntu@<server ip>
# Ships only what the worker needs (no Next.js app, no node_modules): motion-video/, video-worker/,
# lib/luxeMetals.ts, the 4 fonts the videos use and public/motion/. Installs packages + Chrome on the
# server, restarts the service and checks /health.
set -euo pipefail
HOST="${1:?usage: deploy.sh user@host}"
cd "$(dirname "$0")/../.."

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/lib" "$STAGE/public/fonts" "$STAGE/video-worker"
cp -r motion-video "$STAGE/"
cp video-worker/server.mjs "$STAGE/video-worker/"
cp -r video-worker/deploy "$STAGE/video-worker/"
cp lib/luxeMetals.ts "$STAGE/lib/"
cp public/fonts/cormorant-garamond-normal-300-700.woff2 public/fonts/cormorant-garamond-italic-300-700.woff2 \
   public/fonts/montserrat-v31-latin-regular.ttf public/fonts/montserrat-v31-latin-700.woff "$STAGE/public/fonts/"
cp -r public/motion "$STAGE/public/"
cp video-worker/deploy/package.json "$STAGE/package.json"

tar -czf - -C "$STAGE" . | ssh "$HOST" "sudo mkdir -p /opt/ohp-video && sudo tar -xzf - -C /opt/ohp-video && sudo chown -R ohpvideo:ohpvideo /opt/ohp-video"
ssh "$HOST" "cd /opt/ohp-video && sudo -u ohpvideo npm install --omit=dev --no-audit --no-fund && sudo -u ohpvideo npx remotion browser ensure && sudo systemctl restart ohp-video-worker && sleep 8 && curl -fsS http://127.0.0.1:8095/health && echo && echo deployed"
