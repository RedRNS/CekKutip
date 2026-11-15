import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { DevBanner } from './components/DevBanner'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { useI18n } from './i18n'
import Home from './pages/Home'

const HowItWorks = lazy(() => import('./pages/HowItWorks'))
const Evaluation = lazy(() => import('./pages/Evaluation'))
const About = lazy(() => import('./pages/About'))
const Privacy = lazy(() => import('./pages/Privacy'))
const NotFound = lazy(() => import('./pages/NotFound'))

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
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/evaluation" element={<Evaluation />} />
              <Route path="/about" element={<About />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}
