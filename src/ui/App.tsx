import { useEffect, useState } from 'react'
import { createDevices } from '../devices/createDevices.ts'
import { currentLaunchOptions } from '../platform/launchOptions.ts'
import { bindDevices, useDeviceStore } from '../store/deviceStore.ts'
import { loadSettings } from '../store/settingsStore.ts'
import { ConnectionBadge } from './connection/ConnectionBadge.tsx'
import { DevicesPage } from './connection/DevicesPage.tsx'
import { DeviceErrorBanner } from './DeviceErrorBanner.tsx'
import { HistoryPage } from './history/HistoryPage.tsx'
import { RideDetailPage } from './history/RideDetailPage.tsx'
import { t } from './i18n/index.ts'
import { useNavigation, type Screen } from './navigation.ts'
import { RidePage } from './ride/RidePage.tsx'
import { SkyBackdrop } from './SkyBackdrop.tsx'
import { RoutePreviewPage } from './routes/RoutePreviewPage.tsx'
import { RoutesPage } from './routes/RoutesPage.tsx'
import { SettingsPage } from './settings/SettingsPage.tsx'

const TABS = [
  { name: 'routes', label: 'nav.routes' },
  { name: 'history', label: 'nav.history' },
  { name: 'devices', label: 'nav.devices' },
  { name: 'settings', label: 'nav.settings' },
] as const

export function App() {
  const [launch] = useState(currentLaunchOptions)
  const [devices] = useState(() => createDevices(launch))
  const screen = useNavigation((s) => s.screen)
  const navigate = useNavigation((s) => s.navigate)
  const trainerState = useDeviceStore((s) => s.trainerState)

  useEffect(() => bindDevices(devices), [devices])
  useEffect(() => {
    void loadSettings()
  }, [])

  const riding = screen.name === 'ride'
  const activeTab =
    screen.name === 'preview' ? 'routes' : screen.name === 'rideDetail' ? 'history' : screen.name

  return (
    <div className={riding ? 'page page-ride' : 'page'}>
      {!riding && (
        <>
          <SkyBackdrop />
          <header className="app-header">
            <h1>{t('app.name')}</h1>
            <nav className="tabs">
              {TABS.map((tab) => (
                <button
                  key={tab.name}
                  type="button"
                  className={`tab${activeTab === tab.name ? ' tab-active' : ''}`}
                  aria-current={activeTab === tab.name ? 'page' : undefined}
                  onClick={() => navigate({ name: tab.name })}
                >
                  {t(tab.label)}
                </button>
              ))}
            </nav>
            <ConnectionBadge state={trainerState} testId="header-trainer-state" />
          </header>
          {launch.simulator && <p className="notice">{t('app.simulatorNotice')}</p>}
        </>
      )}
      <DeviceErrorBanner />
      <main>
        <ScreenView screen={screen} />
      </main>
    </div>
  )
}

function ScreenView({ screen }: { screen: Screen }) {
  switch (screen.name) {
    case 'routes':
      return <RoutesPage />
    case 'preview':
      return <RoutePreviewPage routeId={screen.routeId} />
    case 'ride':
      return <RidePage />
    case 'history':
      return <HistoryPage />
    case 'rideDetail':
      return <RideDetailPage rideId={screen.rideId} />
    case 'devices':
      return <DevicesPage />
    case 'settings':
      return <SettingsPage />
  }
}
