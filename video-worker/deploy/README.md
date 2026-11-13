# Cinematic Video render server

The AI Media "Cinematic Video" is rendered by `video-worker/server.mjs` (Remotion + headless Chrome) on its
own server, so a video being made never slows the website. One video at a time, the rest wait in line.

## First time (fresh Ubuntu VPS, SSH key access)

1. Copy this folder to the server and run the setup as root:
   ```
   scp -r video-worker/deploy ubuntu@<ip>:/tmp/ohp-deploy
   ssh ubuntu@<ip> "sudo MAIN_SERVER_IP=5.161.101.69 bash /tmp/ohp-deploy/setup-server.sh"
   ```
   It installs Node 20 + Chrome's libraries, a locked-down `ohpvideo` service user, the firewall
   (port 8095 open ONLY to the main server), automatic security updates and the systemd service,
   and prints the token.
2. Deploy the code from the frontend folder: `bash video-worker/deploy/deploy.sh ubuntu@<ip>`
3. On the main server (Dokploy env): `VIDEO_WORKER_URL=http://<ip>:8095` and `VIDEO_WORKER_TOKEN=<token>`.

## Updating

After a change in `motion-video/` or `video-worker/`: `bash video-worker/deploy/deploy.sh ubuntu@<ip>`
(a render already running finishes first; videos waiting are re-sent by the main server).

## Notes

- No GPU: `VIDEO_WORKER_GL=swangle` (software WebGL). Frames are drawn in parallel
  (`VIDEO_WORKER_CONCURRENCY`, default half the cores) - tune after measuring.
- The worker learns its own speed (`speed.json` in its temp folder) for the agents' "Ready in about" clock.
- Health: `curl http://127.0.0.1:8095/health` on the server (no token needed). Logs: `journalctl -u ohp-video-worker -f`.
- Traffic to the main server is plain HTTP limited by the firewall + token; put Caddy in front with a
  DNS name (e.g. video.openhousepal.com) for HTTPS if wanted.
