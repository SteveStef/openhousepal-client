// Upload the video template (frontend/motion-video bundled, plus the fonts and music it uses) to
// the Remotion bucket. RE-RUN AFTER EVERY CHANGE to frontend/motion-video - Lambda renders whatever
// was uploaded last. Same name every time, so REMOTION_SERVE_URL never changes.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { FRONTEND, REGION, SITE_NAME } from './env.mjs'
import { getOrCreateBucket, deploySiteFromBundle } from '@remotion/lambda'

const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'ohp-site-'))
try {
  // only the static files the videos need (like video-worker/deploy/deploy.sh)
  const pub = path.join(stage, 'public')
  fs.mkdirSync(path.join(pub, 'fonts'), { recursive: true })
  for (const f of ['cormorant-garamond-normal-300-700.woff2', 'cormorant-garamond-italic-300-700.woff2', 'montserrat-v31-latin-regular.ttf', 'montserrat-v31-latin-700.woff'])
    fs.copyFileSync(path.join(FRONTEND, 'public/fonts', f), path.join(pub, 'fonts', f))
  fs.cpSync(path.join(FRONTEND, 'public/motion'), path.join(pub, 'motion'), { recursive: true })
  // the app's OWN bundler (same versions as the worker and the in-app preview)
  const { bundle } = await import(pathToFileURL(path.join(FRONTEND, 'node_modules/@remotion/bundler/dist/index.js')).href)
  const outDir = path.join(stage, 'bundle')
  await bundle({ entryPoint: path.join(FRONTEND, 'motion-video/index.ts'), publicDir: pub, outDir })
  const { bucketName } = await getOrCreateBucket({ region: REGION })
  const site = await deploySiteFromBundle({ bucketName, region: REGION, bundleDir: outDir, siteName: SITE_NAME })
  console.log(`uploaded.\nBackend env:\n  REMOTION_SERVE_URL=${site.serveUrl}`)
} finally {
  fs.rmSync(stage, { recursive: true, force: true })
}
