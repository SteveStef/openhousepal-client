// AWS keys for the video account (owner 11/17: video making has its OWN AWS account, OpenHousePal's, in Ohio):
// the shell's VIDEO_AWS_ACCESS_KEY_ID / VIDEO_AWS_SECRET_ACCESS_KEY, else the backend's .env (local copy) -
// the same keys the backend's video makers use (video_lambda_service.aws_session). Without VIDEO_AWS_* it falls
// back to AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY as before. REMOTION_REGION also comes from the .env.
// Never printed. Remotion reads REMOTION_AWS_* first, then AWS_*, so the chosen keys are put in both.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const HERE = path.dirname(fileURLToPath(import.meta.url))
export const FRONTEND = path.resolve(HERE, '..', '..')

const fromFile = {}
const envFile = path.resolve(FRONTEND, '..', 'backend', '.env')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^(VIDEO_AWS_ACCESS_KEY_ID|VIDEO_AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|REMOTION_REGION)=(.*)$/)
    if (m) fromFile[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '')
  }
}
const pick = (k) => process.env[k] || fromFile[k]
const id = pick('VIDEO_AWS_ACCESS_KEY_ID') || pick('AWS_ACCESS_KEY_ID')
const secret = pick('VIDEO_AWS_SECRET_ACCESS_KEY') || pick('AWS_SECRET_ACCESS_KEY')
if (id && secret) {
  for (const p of ['', 'REMOTION_']) {
    process.env[p + 'AWS_ACCESS_KEY_ID'] = id
    process.env[p + 'AWS_SECRET_ACCESS_KEY'] = secret
  }
}

export const REGION = pick('REMOTION_REGION') || 'us-east-1'
export const SITE_NAME = process.env.REMOTION_SITE_NAME || 'ohp-cinematic'
