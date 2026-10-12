import { useState } from 'react'
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
    <div className="panel settings">
      <h3>{t('settings.media')}</h3>
      <label className="field">
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
      <p className="hint">{t('settings.keysLocal')}</p>
    </div>
  )
}
