// Forks in the form editor: a follow-up question stores the exact wording of the answers that open
// it, so editing the parent has to carry the rule along or the follow-up silently stops showing
// (forms audit, 11/04). The server has the same safety net on save (forms_service.clean_question_forks).
import type { FormQuestion } from '@/types'

const isChoice = (q: FormQuestion) => q.type === 'select' || q.type === 'multi_select'

function keptValues(values: string[], before: FormQuestion, after: FormQuestion): string[] {
  if (isChoice(before) && !isChoice(after)) return []
  if (before.options === after.options || !isChoice(after)) return values
  const was = before.options || []
  const now = after.options || []
  // Same number of choices = a rename: each answer follows its choice by position.
  if (was.length === now.length) return Array.from(new Set(values.map(value => (was.includes(value) ? now[was.indexOf(value)] : value))))
  return values.filter(value => now.includes(value))
}

/** One question's edit, with its follow-ups' rules kept in step. No answers left = no fork. */
export function editQuestion(questions: FormQuestion[], questionId: string, updates: Partial<FormQuestion>): FormQuestion[] {
  const before = questions.find(question => question.id === questionId)
  if (!before) return questions
  const after = { ...before, ...updates }
  return questions.map(question => {
    if (question.id === questionId) return after
    const dep = question.depends_on
    if (dep?.question_id !== questionId) return question
    const values = keptValues(dep.values, before, after)
    return { ...question, depends_on: values.length ? { ...dep, values } : null }
  })
}

/** Takes a question off the form; its follow-ups go back to being asked of everyone. */
export function removeQuestion(questions: FormQuestion[], questionId: string): FormQuestion[] {
  const gone = questions.find(question => question.id === questionId)
  if (!gone || gone.locked) return questions
  const parentIds = [gone.id, ...(gone.fields || []).map(field => field.id)]
  return questions
    .filter(question => question.id !== questionId)
    .map(question => (question.depends_on && parentIds.includes(question.depends_on.question_id) ? { ...question, depends_on: null } : question))
}

/** What gets saved: choices trimmed and blanks dropped - and the fork answers with them, so a stray
 *  space on a choice doesn't end up as an answer the server can't find. */
export function tidyChoicesForSave(questions: FormQuestion[]): FormQuestion[] {
  return questions.map(question => {
    const tidy = isChoice(question) ? { ...question, options: (question.options || []).map(option => option.trim()).filter(Boolean) } : question
    if (!tidy.depends_on) return tidy
    const values = tidy.depends_on.values.map(value => value.trim()).filter(Boolean)
    return { ...tidy, depends_on: values.length ? { ...tidy.depends_on, values } : null }
  })
}
