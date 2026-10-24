'use client'

import OhpLoader from '@/components/brand/OhpLoader'

import { Suspense } from 'react'
import { useParams } from 'next/navigation'
import AuthGuard from '@/components/AuthGuard'
import AdminShell from '@/components/admin/AdminShell'

// /admin/<section> and /admin/<section>/<tab> - one page per admin section (lib/adminNav.ts).
export default function AdminSectionPage() {
  const params = useParams<{ section: string; tab?: string[] }>()
  return (
    <AuthGuard>
      <Suspense fallback={<OhpLoader label="Loading admin" />}>
        <AdminShell sectionKey={params.section} tabKey={params.tab?.[0]} />
      </Suspense>
    </AuthGuard>
  )
}
