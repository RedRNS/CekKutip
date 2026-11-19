import { Link } from 'react-router-dom'
import { usePageTitle } from '../hooks'
import { fmt, useI18n } from '../i18n'
import { isRealValue, siteConfig } from '../site.config'

/** The file the web build writes next to the site (scripts/package-extension.ts --site). */
export const EXTENSION_ZIP = '/downloads/cekkutip-extension.zip'

/** Shows `text between backticks` in the monospace face: addresses and file names. */
function InlineCode({ text }: { text: string }) {
  return (
    <>
      {text.split('`').map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="mono">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  )
}

/** The server the extension talks to: the address it was built for. */
function serverHost(): string {
  try {
    return new URL(siteConfig.demoUrl).host
  } catch {
    return window.location.host
  }
}

export default function Extension() {
  const { t } = useI18n()
  usePageTitle('extension')
  const x = t.extensionPage

  return (
    <>
      <div className="page-head">
        <h1>{x.h1}</h1>
        <p className="lede">{x.lede}</p>
      </div>

      <section className="section" aria-labelledby="get-title">
        <h2 id="get-title">{x.getTitle}</h2>
        <div className="download-panel">
          <a className="btn btn--primary" href={EXTENSION_ZIP} download>
            {x.download}
          </a>
          <p className="download-panel__note">{x.getNote}</p>
        </div>
        <dl className="facts">
          <div>
            <dt>{x.factsWorks}</dt>
            <dd>{x.factsWorksValue}</dd>
          </div>
          <div>
            <dt>{x.factsCost}</dt>
            <dd>{x.factsCostValue}</dd>
          </div>
          <div>
            <dt>{x.factsServer}</dt>
            <dd>{fmt(x.factsServerValue, { host: serverHost() })}</dd>
          </div>
        </dl>
      </section>

      <section className="section" aria-labelledby="install-title">
        <h2 id="install-title">{x.installTitle}</h2>
        <ol className="example-steps">
          {x.installSteps.map((s, i) => (
            <li key={s.name}>
              <h3>
                <span className="mono example-steps__num">{String(i + 1).padStart(2, '0')}</span>{' '}
                {s.name}
              </h3>
              <p>
                <InlineCode text={s.text} />
              </p>
            </li>
          ))}
        </ol>
        <p className="muted">{x.installNote}</p>
      </section>

      <section className="section" aria-labelledby="use-title">
        <h2 id="use-title">{x.useTitle}</h2>
        <ul className="plain-list plain-list--spaced">
          {x.useItems.map((item) => (
            <li key={item}>{fmt(item, { menu: t.extension.menuTitle })}</li>
          ))}
        </ul>
      </section>

      <section className="section" aria-labelledby="key-title">
        <h2 id="key-title">{x.keyTitle}</h2>
        <p>{x.key}</p>
        <p className="section__more">
          <Link to="/">{x.keyLink}</Link>
        </p>
      </section>

      <section className="section" aria-labelledby="access-title">
        <h2 id="access-title">{x.accessTitle}</h2>
        <ul className="plain-list plain-list--spaced">
          {x.accessItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <ul className="plain-list plain-list--tight section__more">
          <li>
            <Link to="/privacy">{x.privacyLink}</Link>
          </li>
          {isRealValue(siteConfig.githubUrl) && (
            <li>
              <a href={`${siteConfig.githubUrl}/tree/main/extension`}>{x.sourceLink}</a>
            </li>
          )}
        </ul>
      </section>

      <section className="section" aria-labelledby="update-title">
        <h2 id="update-title">{x.updateTitle}</h2>
        <ul className="plain-list plain-list--spaced">
          {x.updateItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="section" aria-labelledby="help-title">
        <h2 id="help-title">{x.helpTitle}</h2>
        <ul className="plain-list plain-list--spaced">
          {x.helpItems.map((item) => (
            <li key={item}>
              <InlineCode text={item} />
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
