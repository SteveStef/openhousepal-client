# Cinematic Video on AWS Lambda

Final Cinematic Videos are made on AWS Lambda (Remotion Lambda) - nothing runs on the OpenHousePal
server but the API calls (backend `app/services/video_lambda_service.py`). Unset the backend's
`REMOTION_*` env and it falls back to the self-hosted worker (`../server.mjs`, `VIDEO_WORKER_URL`).

```
cd frontend/video-worker/lambda && npm install
node setup.mjs        # once: role + function + bucket (re-run safe)
node deploy-site.mjs  # AFTER EVERY CHANGE to frontend/motion-video (same URL each time)
node quota.mjs        # Lambda "Concurrent executions" (10 on a new account) - `node quota.mjs request` asks for 1000
                      # (11/17: 1000 asked in us-east-2; EC2 spot 64 / G spot 16 asked too - all CASE_OPENED)
```

AWS account (owner 11/17): video making lives in OpenHousePal's OWN AWS account (185143906434, team
"OpenHousePal-Team", $50/month budget + spend limit), separate from the account that keeps the site's files
(421027006363 - s3_service, CloudFront). That account's "advanced mode" only allows work in **Ohio (us-east-2)**:
us-east-1 is limited to global services (IAM, billing, budgets, quotas), so Lambda / EC2 there are denied by the
org's AdvancedModeRegionRestrictionSecurityControlPolicy. Everything video is in us-east-2.

Keys: the backend uses `VIDEO_AWS_ACCESS_KEY_ID` / `VIDEO_AWS_SECRET_ACCESS_KEY` for every video piece
(`video_lambda_service.aws_session()`: Lambda, the rented video / photo machines, the Remotion bucket, the admin
Lambda usage card) and its normal `AWS_*` key for file storage. These scripts (env.mjs) pick the same VIDEO_AWS_*
keys and `REMOTION_REGION` from the shell or backend/.env (falling back to AWS_* when VIDEO_AWS_* isn't set).

Sites: `ohp-cinematic` = what LIVE renders (deploy it only with what's pushed); `ohp-cinematic-test` = the local
copy (`REMOTION_SITE_NAME=ohp-cinematic-test node deploy-site.mjs`), so local design tests never change live.

Backend env (prod):
- `VIDEO_AWS_ACCESS_KEY_ID`, `VIDEO_AWS_SECRET_ACCESS_KEY` (the openhousepal-video user in the video account)
- `REMOTION_FUNCTION_NAME` (remotion-render-4-0-529-mem3008mb-disk2048mb-900sec), `REMOTION_REGION` (us-east-2),
  `REMOTION_SERVE_URL` (https://remotionlambda-useast2-pd88v5u46n.s3.us-east-2.amazonaws.com/sites/ohp-cinematic/index.html),
  `REMOTION_BUCKET` (remotionlambda-useast2-pd88v5u46n), `REMOTION_MEMORY_MB` (3008)
- `REMOTION_MAX_LAMBDAS` (7) - how many Lambdas one video is split across while the account allows only
  10 at once. The backend reads the account's real limit from AWS hourly: at 100+ it uses 40 per video and
  runs several videos at once by itself - no setting to change when AWS raises the limit.
- the video key needs: lambda:InvokeFunction + GetFunction + GetAccountSettings, s3 on the `remotionlambda-*`
  bucket, ec2 RunInstances / Describe* / TerminateInstances / CreateTags (spot machines), ssm:GetParameter (public
  AMI ids), cloudwatch:GetMetricStatistics (admin Provider billing page), servicequotas read.

Cost (11/13, exact from AWS's billed time): 12.8c per 30 s wide video. Each video's cost goes on the
agent's monthly AI usage (Remotion's figure x `studio_motion_lambda_cost_factor` 1.2). Admin >
Costs > Provider billing shows the month's exact Lambda use against AWS's free 400,000 GB-seconds.
