// AWS keys: the shell's AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY, else the backend's .env (local
// copy). Never printed. Remotion reads REMOTION_AWS_* first, then AWS_*.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const HERE = path.dirname(fileURLToPath(import.meta.url))
export const FRONTEND = path.resolve(HERE, '..', '..')
export const REGION = process.env.REMOTION_REGION || 'us-east-1'
export const SITE_NAME = process.env.REMOTION_SITE_NAME || 'ohp-cinematic'

if (!process.env.AWS_ACCESS_KEY_ID) {
  const envFile = path.resolve(FRONTEND, '..', 'backend', '.env')
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY)=(.*)$/)
      if (m) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '')
    }
  }
}
