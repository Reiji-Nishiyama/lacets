import { useEffect } from 'react'
import type { StreetImageProvider } from '../../domain/media/streetImages.ts'
import type { RouteVariant } from '../../store/routeVariant.ts'
import { useSettingsStore } from '../../store/settingsStore.ts'
import {
  ensureStreetImages,
  streetImageKey,
  useStreetImageStore,
} from '../../store/streetImageStore.ts'
import { formatPercent } from '../format.ts'
import { t } from '../i18n/index.ts'

/** 事前確認画面: ルート沿いの路上画像のカバー率（M5「ルートごとの画像カバー率表示」） */
export function StreetImageCoverage({ route }: { route: RouteVariant }) {
  const media = useSettingsStore((s) => s.media)
  const loaded = useSettingsStore((s) => s.loaded)
  const key = streetImageKey(route.variantKey, media)
  const state = useStreetImageStore((s) => s.byKey[key])

  useEffect(() => {
    if (loaded) ensureStreetImages(route, media)
  }, [route, media, loaded])

  const disabled = !media.panoramaxEnabled && !media.mapillaryToken.trim()
  const provider = (p: StreetImageProvider) => t(`visual.provider.${p}`)

  const errors = state?.errors.map((e, i) => (
    <p key={i} className="notice notice-warn">
      {e.kind === 'auth'
        ? t('streetImages.error.auth', { provider: provider(e.provider) })
        : t('streetImages.error.network', { provider: provider(e.provider), message: e.message })}
    </p>
  ))
  const text = disabled
    ? t('streetImages.pillDisabled')
    : !state || state.status === 'loading'
      ? t('streetImages.loading')
      : state.index.length === 0
        ? t('streetImages.pillNone')
        : t('streetImages.pill', {
            coverage: formatPercent(state.coverageRatio),
            counts: (Object.entries(state.counts) as [StreetImageProvider, number][])
              .map(([p, count]) => t('streetImages.count', { provider: provider(p), count }))
              .join('、'),
          })

  return (
    <>
      <span className="map-pill" data-testid="street-coverage">
        {text}
      </span>
      {errors && errors.length > 0 && <div className="map-errors">{errors}</div>}
    </>
  )
}
