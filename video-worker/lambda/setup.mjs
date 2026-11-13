// One-time: the IAM role Remotion's Lambda runs as, the render function and the S3 bucket.
// Prints the env values the backend needs. Safe to re-run (re-uses what exists).
import fs from 'node:fs'
import path from 'node:path'
import { HERE, REGION } from './env.mjs'
import { IAMClient, GetRoleCommand, CreateRoleCommand, PutRolePolicyCommand } from '@aws-sdk/client-iam'
import { getRolePolicy, deployFunction, getOrCreateBucket } from '@remotion/lambda'

export const MEMORY = Number(process.env.REMOTION_MEMORY_MB || 3008) // 3008 = the most a new AWS account allows
const DISK = 2048
const TIMEOUT = 900

const iam = new IAMClient({ region: REGION })
const ROLE = 'remotion-lambda-role'
let made = false
try { await iam.send(new GetRoleCommand({ RoleName: ROLE })); console.log('role exists') } catch {
  await iam.send(new CreateRoleCommand({
    RoleName: ROLE, Description: 'Remotion Lambda renderer (OpenHousePal Cinematic Video)',
    AssumeRolePolicyDocument: JSON.stringify({ Version: '2012-10-17', Statement: [{ Effect: 'Allow', Principal: { Service: 'lambda.amazonaws.com' }, Action: 'sts:AssumeRole' }] }),
  }))
  made = true
  console.log('role created')
}
await iam.send(new PutRolePolicyCommand({ RoleName: ROLE, PolicyName: 'remotion-lambda-policy', PolicyDocument: getRolePolicy() }))
if (made) await new Promise(r => setTimeout(r, 12000)) // IAM takes a moment to see a new role

const fn = await deployFunction({ region: REGION, timeoutInSeconds: TIMEOUT, memorySizeInMb: MEMORY, diskSizeInMb: DISK,
  createCloudWatchLogGroup: true, cloudWatchLogRetentionPeriodInDays: 14 })
const { bucketName } = await getOrCreateBucket({ region: REGION })
const out = { functionName: fn.functionName, bucketName, region: REGION, memory: MEMORY, disk: DISK }
fs.writeFileSync(path.join(HERE, 'deployed.local.json'), JSON.stringify(out, null, 1))
console.log(`\nBackend env:\n  REMOTION_FUNCTION_NAME=${fn.functionName}\n  REMOTION_REGION=${REGION}\n  REMOTION_MEMORY_MB=${MEMORY}\n(REMOTION_SERVE_URL comes from deploy-site.mjs)`)
