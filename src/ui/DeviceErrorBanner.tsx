import { useDeviceStore } from '../store/deviceStore.ts'
import { t } from './i18n/index.ts'

export function DeviceErrorBanner() {
  const error = useDeviceStore((s) => s.error)
  if (!error) return null
  return (
    <p className="notice notice-error" role="alert">
      {t(error.kind === 'connectFailed' ? 'error.connectFailed' : 'error.commandFailed', {
        detail: error.detail,
      })}
    </p>
  )
}
