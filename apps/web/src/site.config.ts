/**
 * Team and contact details shown on public pages (About, Footer).
 * A production build FAILS while any value still starts with 'TODO'.
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
  teamName: 'Halu Hunters',
  members: [
    { name: 'Renisa Assyifa Putri', program: 'Teknik Informatika' },
    { name: 'Shellyn Euriska Putri', program: 'Teknik Informatika' },
    { name: 'Nadira Hikmah Fatheena', program: 'Teknik Informatika' },
    { name: 'Fauza Kaizaku Setiawan', program: 'Teknik Informatika' },
    { name: 'Arkaan Wisnu Pratama', program: 'Teknik Informatika' },
    { name: 'Regita Hutri Cahyaningrum', program: 'Teknik Informatika' },
  ],
  supervisor: 'Dany Candra Febrianto, S.Kom., M.Eng',
  university: 'Telkom University Purwokerto',
  contactEmail: 'renisaassyifaputri@student.telkomuniversity.ac.id',
  githubUrl: 'https://github.com/RedRNS/CekKutip',
  // The address Render is expected to give the service named "cekkutip". If Render gives another
  // one (the name was taken), change this line and push: the site redeploys by itself.
  demoUrl: 'https://cekkutip.onrender.com',
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
