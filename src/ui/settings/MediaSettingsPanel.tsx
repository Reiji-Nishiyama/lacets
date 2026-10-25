import { useState } from 'react'
import {
  MAPTILER_FREE_MONTHLY_REQUESTS,
  maptilerUsageThisMonth,
} from '../../media/maptilerUsage.ts'
import { updateMediaSettings, useSettingsStore } from '../../store/settingsStore.ts'
import { t } from '../i18n/index.ts'

function SecretField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="field field-stacked">
      <label>
        <span>{label}</span>
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <button type="button" className="button-subtle" onClick={() => setVisible((v) => !v)}>
        {t(visible ? 'settings.hide' : 'settings.show')}
      </button>
      <p className="hint">{hint}</p>
    </div>
  )
}

/** 地図・路上画像の設定（Panoramax、Mapillary のトークン、MapTiler のキー） */
export function MediaSettingsPanel() {
  const media = useSettingsStore((s) => s.media)
  return (
    <section className="settings-section">
      <div className="settings-intro">
        <h3>{t('settings.media')}</h3>
        <p className="hint">{t('settings.keysLocal')}</p>
      </div>
      <div className="settings-fields">
        <label className="field field-check">
          <input
            type="checkbox"
            checked={media.panoramaxEnabled}
            onChange={(e) => updateMediaSettings({ panoramaxEnabled: e.target.checked })}
          />
          <span>{t('settings.panoramax')}</span>
        </label>
        <SecretField
          label={t('settings.mapillaryToken')}
          hint={t('settings.mapillaryHint')}
          value={media.mapillaryToken}
          onChange={(mapillaryToken) => updateMediaSettings({ mapillaryToken })}
        />
        <SecretField
          label={t('settings.maptilerKey')}
          hint={t('settings.maptilerHint')}
          value={media.maptilerKey}
          onChange={(maptilerKey) => updateMediaSettings({ maptilerKey })}
        />
        <MaptilerUsage />
      </div>
    </section>
  )
}

/** MapTiler の無料枠に対する、この端末の今月の使用量の目安 */
function MaptilerUsage() {
  const [used] = useState(() => maptilerUsageThisMonth())
  const ratio = used / MAPTILER_FREE_MONTHLY_REQUESTS
  return (
    <div className="field" data-testid="maptiler-usage">
      <p className={ratio >= 0.8 ? 'usage-high' : undefined}>
        {t('settings.maptilerUsage', {
          used: used.toLocaleString('ja-JP'),
          limit: MAPTILER_FREE_MONTHLY_REQUESTS.toLocaleString('ja-JP'),
        })}
        {ratio >= 0.8 && (
          <> {t('settings.maptilerUsageHigh', { percent: Math.round(ratio * 100) })}</>
        )}
      </p>
      <p className="hint">{t('settings.maptilerUsageHint')}</p>
    </div>
  )
}
