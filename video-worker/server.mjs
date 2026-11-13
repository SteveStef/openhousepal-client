// Cinematic Video worker - renders AI Media "Cinematic Video" projects to MP4 with Remotion.
// The backend (studio_motion_service.py) submits a job with the video's props, polls it, then
// downloads the file and stores it in S3. One render at a time (each render already uses every
// core), the rest wait in line.
//
//   node video-worker/server.mjs            (from the frontend folder)
//   env: VIDEO_WORKER_PORT=8095  VIDEO_WORKER_TOKEN=<shared secret, optional locally>
//        VIDEO_WORKER_GL=angle|swangle|egl  (default: angle on Windows, swangle elsewhere - no GPU)
//        VIDEO_WORKER_CONCURRENCY=<frames rendered in parallel, default half the cores>
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { bundle } from '@remotion/bundler'
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENTRY = path.join(ROOT, 'motion-video', 'index.ts')
const PUBLIC_DIR = path.join(ROOT, 'public')
const PORT = Number(process.env.VIDEO_WORKER_PORT || 8095)
const TOKEN = process.env.VIDEO_WORKER_TOKEN || ''
const GL = process.env.VIDEO_WORKER_GL || (process.platform === 'win32' ? 'angle' : 'swangle')
const CONCURRENCY = Number(process.env.VIDEO_WORKER_CONCURRENCY || Math.max(1, Math.floor(os.cpus().length / 2)))
const OUT_DIR = path.join(os.tmpdir(), 'ohp-video-worker')
fs.mkdirSync(OUT_DIR, { recursive: true })

const jobs = new Map() // id -> job
const queue = []
let running = null

// ---- how fast THIS machine makes videos (owner 11/12: agents waiting in line see a real wait time).
// Learned from every finished render (kept across restarts in speed.json); until the first one, a
// guess from the core count (measured 11/11: ~0.52 s a frame on 8 cores, no GPU).
const FPS_GUESS = 30 // motion-video/types.ts FPS
// kept outside the temp folder on the server (VIDEO_WORKER_DATA_DIR) so a restart/deploy keeps it
const SPEED_FILE = path.join(process.env.VIDEO_WORKER_DATA_DIR || OUT_DIR, 'speed.json')
let speed = { msPerFrame: (520 * 8) / Math.max(1, os.cpus().length), startMs: 15000, samples: 0 }
try { speed = { ...speed, ...JSON.parse(fs.readFileSync(SPEED_FILE, 'utf8')) } } catch { /* first run */ }
function learn(job) {
  if (!job.frames || !job.firstFrameAt || !job.finishedAt) return
  const per = (job.finishedAt - job.firstFrameAt) / job.frames
  const start = job.firstFrameAt - job.startedAt
  const a = speed.samples ? 0.3 : 1 // the first real render replaces the guess outright
  speed = { msPerFrame: speed.msPerFrame * (1 - a) + per * a, startMs: speed.startMs * (1 - a) + start * a, samples: speed.samples + 1 }
  fs.writeFile(SPEED_FILE, JSON.stringify(speed), () => {})
}
const framesOf = (job) => job.frames || Math.round((Number(job.props?.length) || 30) * FPS_GUESS)
const fullMs = (job) => speed.startMs + framesOf(job) * speed.msPerFrame
function leftMs(job) {
  if (job !== running) return fullMs(job)
  const p = job.progress || 0
  if (p > 0.03 && job.firstFrameAt) return Math.max(2000, ((Date.now() - job.firstFrameAt) / p) * (1 - p) + 2000)
  return Math.max(5000, fullMs(job) - (Date.now() - job.startedAt))
}

// ---- bundle (rebuilt when the video's source files change, so local edits show up)
let bundled = null
let bundledAt = 0
function newestSourceMtime() {
  let newest = 0
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else newest = Math.max(newest, fs.statSync(p).mtimeMs)
    }
  }
  walk(path.join(ROOT, 'motion-video'))
  newest = Math.max(newest, fs.statSync(path.join(ROOT, 'lib', 'luxeMetals.ts')).mtimeMs)
  return newest
}
async function serveUrl() {
  const m = newestSourceMtime()
  if (!bundled || m > bundledAt) {
    const t0 = Date.now()
    const old = bundled
    bundled = await bundle({ entryPoint: ENTRY, publicDir: PUBLIC_DIR })
    bundledAt = Date.now()
    // each bundle is a ~100 MB copy in the temp folder - drop the one it replaces (renders run one
    // at a time and fetch serveUrl() at their start, so nothing is still reading it)
    if (old) fs.rm(old, { recursive: true, force: true }, () => {})
    console.log(`[video-worker] bundled in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  }
  return bundled
}

function publicJob(j) {
  const pos = queue.indexOf(j.id)
  // ahead = videos made before this one (the one being made now + those earlier in line)
  const ahead = pos >= 0 ? pos + (running ? 1 : 0) : 0
  let waitMs = 0
  if (pos >= 0) {
    if (running) waitMs += leftMs(running)
    for (const id of queue.slice(0, pos)) { const o = jobs.get(id); if (o) waitMs += fullMs(o) }
  }
  const active = j.status === 'queued' || j.status === 'rendering'
  return {
    id: j.id, status: j.status, progress: Math.round((j.progress || 0) * 1000) / 1000,
    queue_position: pos >= 0 ? pos + 1 : 0, ahead, error: j.error || null,
    wait_seconds: active ? Math.round(waitMs / 1000) : 0,
    eta_seconds: active ? Math.round((waitMs + leftMs(j)) / 1000) : 0,
    learned: speed.samples > 0,
    seconds: j.finishedAt && j.startedAt ? Math.round((j.finishedAt - j.startedAt) / 100) / 10 : null,
    frames: j.frames || null, fps: j.fps || null, width: j.width || null, height: j.height || null,
  }
}

async function runNext() {
  if (running || !queue.length) return
  const id = queue.shift()
  const job = jobs.get(id)
  if (!job) return runNext()
  running = job
  job.status = 'rendering'
  job.startedAt = Date.now()
  try {
    const url = await serveUrl()
    const chromiumOptions = { gl: GL, disableWebSecurity: true }
    const composition = await selectComposition({ serveUrl: url, id: 'CinematicVideo', inputProps: job.props, chromiumOptions })
    job.frames = composition.durationInFrames; job.fps = composition.fps; job.width = composition.width; job.height = composition.height
    await renderMedia({
      composition, serveUrl: url, codec: 'h264', crf: 21, audioCodec: 'aac',
      outputLocation: job.out, inputProps: job.props, chromiumOptions, concurrency: CONCURRENCY,
      timeoutInMilliseconds: 180000,
      onProgress: ({ progress }) => { if (progress > 0 && !job.firstFrameAt) job.firstFrameAt = Date.now(); job.progress = progress },
    })
    // A cover still (the opening, once it has faded in) for the player and the projects list.
    try {
      job.poster = job.out.replace(/\.mp4$/, '.jpg')
      await renderStill({
        composition, serveUrl: url, output: job.poster, inputProps: job.props, chromiumOptions,
        frame: Math.min(composition.durationInFrames - 1, Math.round(2.6 * composition.fps)), imageFormat: 'jpeg', jpegQuality: 86,
      })
    } catch (e) { job.poster = null; console.error('[video-worker] poster failed', String(e?.message || e).slice(0, 200)) }
    job.status = 'done'
    job.progress = 1
    job.finishedAt = Date.now()
    learn(job)
  } catch (e) {
    job.status = 'failed'
    job.error = String(e?.message || e).slice(0, 600)
    console.error('[video-worker] job failed', id, job.error)
  } finally {
    job.finishedAt = Date.now()
    running = null
    setImmediate(runNext)
  }
}

// Old files are cleared after 3 hours (the backend copies each one to S3 right away).
setInterval(() => {
  const cutoff = Date.now() - 3 * 3600 * 1000
  for (const [id, j] of jobs) {
    if ((j.finishedAt || j.createdAt) < cutoff && j.status !== 'rendering') {
      fs.rm(j.out, { force: true }, () => {})
      if (j.poster) fs.rm(j.poster, { force: true }, () => {})
      jobs.delete(id)
    }
  }
}, 10 * 60 * 1000).unref()

function send(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x')
    if (url.pathname === '/health') {
      // wait_seconds: how long a video sent now would wait before it starts (the page's "To make" estimate)
      let waitMs = running ? leftMs(running) : 0
      for (const id of queue) { const o = jobs.get(id); if (o) waitMs += fullMs(o) }
      return send(res, 200, { ok: true, running: running ? running.id : null, queued: queue.length, gl: GL, speed,
        wait_seconds: Math.round(waitMs / 1000), sec_per_frame: speed.msPerFrame / 1000, start_seconds: speed.startMs / 1000, learned: speed.samples > 0 })
    }
    if (TOKEN && req.headers['x-worker-token'] !== TOKEN) return send(res, 401, { error: 'unauthorized' })

    if (req.method === 'POST' && url.pathname === '/jobs') {
      let raw = ''
      for await (const chunk of req) { raw += chunk; if (raw.length > 2_000_000) return send(res, 413, { error: 'too large' }) }
      const body = JSON.parse(raw || '{}')
      if (!body.props || !Array.isArray(body.props.photos)) return send(res, 400, { error: 'props.photos required' })
      const id = crypto.randomUUID()
      const job = { id, props: body.props, status: 'queued', progress: 0, createdAt: Date.now(), out: path.join(OUT_DIR, `${id}.mp4`) }
      jobs.set(id, job)
      queue.push(id)
      setImmediate(runNext)
      return send(res, 201, publicJob(job))
    }
    const m = url.pathname.match(/^\/jobs\/([0-9a-f-]{36})(\/file|\/poster)?$/)
    if (m) {
      const job = jobs.get(m[1])
      if (!job) return send(res, 404, { error: 'not found' })
      if (req.method === 'DELETE') {
        const qi = queue.indexOf(job.id); if (qi >= 0) queue.splice(qi, 1)
        if (job.status !== 'rendering') {
          fs.rm(job.out, { force: true }, () => {})
          if (job.poster) fs.rm(job.poster, { force: true }, () => {})
          jobs.delete(job.id)
        }
        return send(res, 200, { ok: true })
      }
      if (m[2] === '/poster') {
        if (!job.poster || !fs.existsSync(job.poster)) return send(res, 404, { error: 'no poster' })
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': fs.statSync(job.poster).size })
        return fs.createReadStream(job.poster).pipe(res)
      }
      if (m[2]) {
        if (job.status !== 'done' || !fs.existsSync(job.out)) return send(res, 409, { error: 'not ready' })
        res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': fs.statSync(job.out).size })
        return fs.createReadStream(job.out).pipe(res)
      }
      return send(res, 200, publicJob(job))
    }
    return send(res, 404, { error: 'not found' })
  } catch (e) {
    return send(res, 500, { error: String(e?.message || e) })
  }
})

// A headless-browser pipe that breaks mid-render (seen: "write EOF" when the disk filled up) surfaces
// as a stray promise rejection. The render that hit it fails on its own and is marked failed; don't let
// it take the whole worker (and every queued job) down with it.
process.on('unhandledRejection', (e) => console.error('[video-worker] stray error (worker kept running):', e?.message || e))

server.listen(PORT, () => {
  console.log(`[video-worker] listening on ${PORT} (gl=${GL}, concurrency=${CONCURRENCY})`)
  serveUrl().catch(e => console.error('[video-worker] first bundle failed', e))
})
