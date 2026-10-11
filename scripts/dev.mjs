// `npm run dev`: starts the webpack dev server (never Turbopack - its postcss workers OOM this
// machine) and pre-compiles every dashboard route in the background via warm-dev.mjs, so the
// first click on each tab is fast without anyone having to run a second command.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const nextBin = require.resolve('next/dist/bin/next')

const server = spawn(process.execPath, [nextBin, 'dev', '--webpack', ...process.argv.slice(2)], { stdio: 'inherit' })
server.on('exit', (code) => process.exit(code ?? 0))
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.kill(sig))

import('./warm-dev.mjs').catch((err) => console.log(`[warm] skipped: ${err.message}`))
