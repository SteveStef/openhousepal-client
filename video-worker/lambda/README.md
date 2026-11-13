# Cinematic Video on AWS Lambda

Final Cinematic Videos are made on AWS Lambda (Remotion Lambda) - nothing runs on the OpenHousePal
server but the API calls (backend `app/services/video_lambda_service.py`). Unset the backend's
`REMOTION_*` env and it falls back to the self-hosted worker (`../server.mjs`, `VIDEO_WORKER_URL`).

```
cd frontend/video-worker/lambda && npm install
node setup.mjs        # once: role + function + bucket (re-run safe)
node deploy-site.mjs  # AFTER EVERY CHANGE to frontend/motion-video (same URL each time)
node quota.mjs        # Lambda "Concurrent executions" (10 on a new account) - `node quota.mjs request` asks for 1000
```

Backend env (prod):
- `REMOTION_FUNCTION_NAME`, `REMOTION_SERVE_URL`, `REMOTION_REGION` (us-east-1), `REMOTION_MEMORY_MB` (3008)
- `REMOTION_MAX_LAMBDAS` (7) - how many Lambdas one video is split across while the account allows only
  10 at once. The backend reads the account's real limit from AWS hourly: at 100+ it uses 40 per video and
  runs several videos at once by itself - no setting to change when AWS raises the limit.
- the AWS key (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`) needs: lambda:InvokeFunction on the
  function, s3 Get/List/Delete on the `remotionlambda-*` bucket, cloudwatch:GetMetricStatistics
  (admin Provider billing page) - Remotion's `getUserPolicy()` covers the first two.

Cost (11/13, exact from AWS's billed time): 12.8c per 30 s wide video. Each video's cost goes on the
agent's monthly AI usage (Remotion's figure x `studio_motion_lambda_cost_factor` 1.2). Admin >
Costs > Provider billing shows the month's exact Lambda use against AWS's free 400,000 GB-seconds.
