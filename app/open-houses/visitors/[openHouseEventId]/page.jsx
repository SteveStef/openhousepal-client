'use client'

import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import BrokerAuthorizationGuard from '@/components/BrokerAuthorizationGuard'
import OpenHouseVisitors from '../../components/OpenHouseVisitors'

// Full-page Visitor Insights (deep links like "View Sign-in" from a lead land here). The Opens
// screen shows the same view in a pop-up instead - see VisitorsPopup on /open-houses.
// Same guards as /open-houses (Day 4 audit 11/18): the daily briefing email links here, and a
// signed-out tap used to show "Error Loading Visitors" instead of the sign-in page.
export default function OpenHouseVisitorsPage() {
  return (
    <AuthGuard>
      <BrokerAuthorizationGuard>
        <SubscriptionGuard>
          <OpenHouseVisitors />
        </SubscriptionGuard>
      </BrokerAuthorizationGuard>
    </AuthGuard>
  )
}
