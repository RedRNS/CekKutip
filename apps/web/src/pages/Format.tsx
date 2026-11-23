import { FormatTool } from '../components/FormatTool'
import { usePageTitle } from '../hooks'
import { useI18n } from '../i18n'

export default function Format() {
  const { t } = useI18n()
  usePageTitle('format')

  return (
    <>
      <div className="page-head print-hide">
        <h1>{t.format.h1}</h1>
        <p className="lede">{t.format.lede}</p>
      </div>

      <FormatTool />
    </>
  )
}
