/**
 * Team and contact details shown on public pages (About, Footer).
 * Every value below is a placeholder. A production build FAILS while any
 * value still starts with 'TODO'. Replace them before deploying.
 */
export interface SiteConfig {
  teamName: string
  members: { name: string; program: string }[]
  supervisor: string
  university: string
  contactEmail: string
  githubUrl: string
  demoUrl: string
}

export const siteConfig: SiteConfig = {
  teamName: 'TODO: team name',
  members: [
    { name: 'TODO: member name 1', program: 'TODO: study program' },
    { name: 'TODO: member name 2', program: 'TODO: study program' },
  ],
  supervisor: 'TODO: supervisor name',
  university: 'TODO: university (Telkom University Purwokerto)',
  contactEmail: 'TODO: contact email',
  githubUrl: 'TODO: GitHub URL',
  demoUrl: 'TODO: demo URL',
}

export function findTodoFields(config: SiteConfig = siteConfig): string[] {
  const out: string[] = []
  const check = (label: string, value: string) => {
    if (value.startsWith('TODO')) out.push(label)
  }
  check('teamName', config.teamName)
  config.members.forEach((m, i) => {
    check(`members[${i}].name`, m.name)
    check(`members[${i}].program`, m.program)
  })
  check('supervisor', config.supervisor)
  check('university', config.university)
  check('contactEmail', config.contactEmail)
  check('githubUrl', config.githubUrl)
  check('demoUrl', config.demoUrl)
  return out
}

/** A value is linkable only when it is a real URL, not a placeholder. */
export function isRealValue(value: string): boolean {
  return !value.startsWith('TODO')
}
