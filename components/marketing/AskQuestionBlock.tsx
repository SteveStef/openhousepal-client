'use client'

import AskQuestionCard from '@/components/home/AskQuestionCard'
import { useOptionalAuth } from '@/contexts/AuthContext'

export default function AskQuestionBlock() {
  return <AskQuestionCard isAuthenticated={!!useOptionalAuth()?.user} />
}
