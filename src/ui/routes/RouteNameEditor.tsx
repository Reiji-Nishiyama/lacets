import { useState } from 'react'
import { renameRoute } from '../../store/routeRepository.ts'
import { t } from '../i18n/index.ts'

/**
 * 事前確認の見出しのルート名。「名前を変える」で入力欄になり、Enter か「保存」で保存、
 * Esc か「やめる」で元に戻す
 */
export function RouteNameEditor({ routeId, name }: { routeId: string; name: string }) {
  const [draft, setDraft] = useState<string | null>(null)

  if (draft === null) {
    return (
      <div className="route-name-row">
        <h2 className="page-hero-title">{name}</h2>
        <button type="button" className="back-pill" onClick={() => setDraft(name)}>
          {t('routes.rename')}
        </button>
      </div>
    )
  }

  const save = async () => {
    if (await renameRoute(routeId, draft)) setDraft(null)
  }
  return (
    <form
      className="route-name-row"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <input
        type="text"
        className="route-name-input"
        aria-label={t('routes.nameLabel')}
        value={draft}
        maxLength={80}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setDraft(null)
        }}
      />
      <button type="submit" disabled={!draft.trim()}>
        {t('routes.renameSave')}
      </button>
      <button type="button" className="button-subtle" onClick={() => setDraft(null)}>
        {t('routes.renameCancel')}
      </button>
    </form>
  )
}
