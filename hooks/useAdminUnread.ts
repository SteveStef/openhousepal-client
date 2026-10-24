'use client'

import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'

// The admin's unread support tickets + public questions - the red counts on Inbox in the top bar
// and on the admin pages. Refreshes on focus, on a short poll, and when a page says it read one.
export const ADMIN_UNREAD_EVENT = 'admin-unread:refresh'

export function useAdminUnread(pollMs = 15000): { support: number; questions: number; refresh: () => void } {
  const { user, isLoading } = useAuth()
  const [support, setSupport] = useState(0)
  const [questions, setQuestions] = useState(0)
  const isAdmin = !!user?.is_admin

  const refresh = useCallback(() => {
    if (!isAdmin) return
    api.admin.getSupportUnreadCount().then(({ success, data }) => { if (success && data) setSupport(data.unread_count) })
    api.admin.getPublicQuestionsUnreadCount().then(({ success, data }) => { if (success && data) setQuestions(data.unread_count) })
  }, [isAdmin])

  useEffect(() => {
    if (isLoading || !isAdmin) return
    refresh()
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    window.addEventListener(ADMIN_UNREAD_EVENT, onFocus)
    const t = setInterval(refresh, pollMs)
    return () => { window.removeEventListener('focus', onFocus); window.removeEventListener(ADMIN_UNREAD_EVENT, onFocus); clearInterval(t) }
  }, [isLoading, isAdmin, refresh, pollMs])

  return { support, questions, refresh }
}
