import { t } from './i18n/index.ts'

export function App() {
  return (
    <main className="app">
      <h1>{t('app.name')}</h1>
      <p>{t('app.tagline')}</p>
    </main>
  )
}
