// The team name on the Agent Hub (owner, 11/18): it sits beside the brokerage with a dot -
// "Main Line Realty · The Smith Group" - whenever the agent has a team name and hasn't switched
// "Show my team name on my Agent Hub" off (hub config showTeamOnHub; missing = on). The switch is
// in the Agent Hub editor (Profile) and the setup flow's About step. The email signature keeps its
// own Team switch (fields.team.include), and the Save Contact card its own.

export function hubTeamName(profile: { team?: string | null }, showTeamOnHub?: boolean | null): string {
  if (showTeamOnHub === false) return ''
  return String(profile?.team || '').trim()
}

/** "Brokerage · Team" (or just whichever of the two there is). */
export function hubCompanyLine(profile: { brokerage?: string | null; team?: string | null }, showTeamOnHub?: boolean | null): string {
  return [String(profile?.brokerage || '').trim(), hubTeamName(profile, showTeamOnHub)].filter(Boolean).join(' · ')
}
