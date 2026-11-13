// Owner 11/13: ask AWS to raise Lambda "Concurrent executions" (10 on new accounts) so renders run wide.
// usage: node quota.mjs [request]   (no arg = just show the current value + any open request)
import { REGION } from './env.mjs'
import { ServiceQuotasClient, GetServiceQuotaCommand, RequestServiceQuotaIncreaseCommand, ListRequestedServiceQuotaChangeHistoryByQuotaCommand } from '@aws-sdk/client-service-quotas'

const sq = new ServiceQuotasClient({ region: REGION })
const Q = { ServiceCode: 'lambda', QuotaCode: 'L-B99A9384' } // Concurrent executions
const cur = await sq.send(new GetServiceQuotaCommand(Q))
console.log('current', cur.Quota?.QuotaName, cur.Quota?.Value)
const hist = await sq.send(new ListRequestedServiceQuotaChangeHistoryByQuotaCommand(Q))
for (const r of hist.RequestedQuotas || []) console.log('request', r.Id, r.DesiredValue, r.Status, r.Created)
if (process.argv[2] === 'request' && !(hist.RequestedQuotas || []).some(r => ['PENDING', 'CASE_OPENED'].includes(r.Status))) {
  const r = await sq.send(new RequestServiceQuotaIncreaseCommand({ ...Q, DesiredValue: 1000 }))
  console.log('requested', r.RequestedQuota?.Id, r.RequestedQuota?.DesiredValue, r.RequestedQuota?.Status)
}
