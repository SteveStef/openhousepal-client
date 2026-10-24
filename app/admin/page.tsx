'use client'

import OhpLoader from '@/components/brand/OhpLoader'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AuthGuard from '@/components/AuthGuard'
import AdminShell from '@/components/admin/AdminShell'
import { adminHref } from '@/lib/adminNav'

// /admin = the Overview. Each other section is its own page (/admin/<section>/<tab>, see
// lib/adminNav.ts); an old /admin?tab=<x> link goes straight to where that tab lives now.
export default function AdminDashboard() {
  return (
    <AuthGuard>
      <Suspense fallback={<OhpLoader label="Loading admin" />}>
        <AdminHome />
      </Suspense>
    </AuthGuard>
  )
}

function AdminHome() {
  const router = useRouter()
  const legacy = useSearchParams().get('tab')
  const target = legacy ? adminHref(legacy) : '/admin'
  useEffect(() => { if (target !== '/admin') router.replace(target) }, [target, router])
  if (target !== '/admin') return <OhpLoader label="Loading admin" />
  return <AdminShell sectionKey="overview" />
}
