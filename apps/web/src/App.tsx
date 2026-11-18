import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { DevBanner } from './components/DevBanner'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { useI18n } from './i18n'
import About from './pages/About'
import Evaluation from './pages/Evaluation'
import Home from './pages/Home'
import HowItWorks from './pages/HowItWorks'
import NotFound from './pages/NotFound'
import Privacy from './pages/Privacy'

/*
 * Pages are bundled with the app, not split. Each page is only a few KB, and splitting them made a
 * direct visit wait for two requests in a row (app, then page). That pushed the Largest Contentful
 * Paint from 0.8 s to about 2.7 s on the lab's mobile profile, and let the footer jump when the page
 * arrived (layout shift 0.2 on About). See docs/DECISIONS.md.
 */

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  const { t } = useI18n()
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        {t.nav.skip}
      </a>
      <DevBanner />
      <Header />
      <main id="main" className="main" tabIndex={-1}>
        <div className="container">
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/evaluation" element={<Evaluation />} />
            <Route path="/about" element={<About />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>
      <Footer />
    </div>
  )
}
