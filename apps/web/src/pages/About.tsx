import { Link } from 'react-router-dom'
import { usePageTitle } from '../hooks'
import { useI18n } from '../i18n'
import { isRealValue, siteConfig } from '../site.config'

function MaybeLink({ href, children }: { href: string; children: string }) {
  return isRealValue(href) ? <a href={href}>{children}</a> : <span>{children}</span>
}

export default function About() {
  const { t } = useI18n()
  usePageTitle('about')

  return (
    <>
      <div className="page-head">
        <h1>{t.about.h1}</h1>
        <p className="lede">{t.about.lede}</p>
      </div>

      <section className="section" aria-labelledby="story-title">
        <h2 id="story-title">{t.about.storyTitle}</h2>
        <p>{t.about.story}</p>
      </section>

      <section className="section" aria-labelledby="team-title">
        <h2 id="team-title">{t.about.teamTitle}</h2>
        <p className="team-name">{siteConfig.teamName}</p>
        <ul className="member-list">
          {siteConfig.members.map((m) => (
            <li key={m.name}>
              <span className="member-list__name">{m.name}</span>
              <span className="member-list__program">{m.program}</span>
            </li>
          ))}
        </ul>
        <dl className="facts">
          <div>
            <dt>{t.about.supervisorTitle}</dt>
            <dd>{siteConfig.supervisor}</dd>
          </div>
          <div>
            <dt>{t.about.universityTitle}</dt>
            <dd>{siteConfig.university}</dd>
          </div>
          <div>
            <dt>{t.about.competitionTitle}</dt>
            <dd>{t.about.competition}</dd>
          </div>
        </dl>
      </section>

      <section className="section" aria-labelledby="about-limits-title">
        <h2 id="about-limits-title">{t.about.limitsTitle}</h2>
        <p>
          {t.about.limits} <Link to="/how-it-works">{t.about.limitsLink}</Link>
        </p>
      </section>

      <section className="section" aria-labelledby="contact-title">
        <h2 id="contact-title">{t.about.contactTitle}</h2>
        <ul className="plain-list plain-list--tight">
          <li>
            {t.about.contactEmail}:{' '}
            {isRealValue(siteConfig.contactEmail) ? (
              <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>
            ) : (
              siteConfig.contactEmail
            )}
          </li>
          <li>
            <MaybeLink href={siteConfig.githubUrl}>{t.about.github}</MaybeLink>
          </li>
          <li>
            <MaybeLink href={siteConfig.demoUrl}>{t.about.demo}</MaybeLink>
          </li>
        </ul>
      </section>

      <section className="section" aria-labelledby="services-title">
        <h2 id="services-title">{t.about.servicesTitle}</h2>
        <dl className="facts">
          {t.about.services.map((s) => (
            <div key={s.name}>
              <dt>
                <a href={s.url}>{s.name}</a>
              </dt>
              <dd>{s.text}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  )
}
