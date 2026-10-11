import type { ConnectionState } from '../../devices/ConnectionState.ts'
import { t } from '../i18n/index.ts'

export function ConnectionBadge({ state, testId }: { state: ConnectionState; testId?: string }) {
  return (
    <span className={`badge badge-${state}`} data-testid={testId}>
      {t(`connection.${state}`)}
    </span>
  )
}
