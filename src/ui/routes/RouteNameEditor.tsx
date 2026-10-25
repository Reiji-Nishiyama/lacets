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
        <button
          type="button"
          className="icon-button"
          aria-label={t('routes.rename')}
          title={t('routes.rename')}
          onClick={() => setDraft(name)}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              d="M4 20 L5 15 L15.5 4.5 a2.1 2.1 0 0 1 3 0 l1 1 a2.1 2.1 0 0 1 0 3 L9 19 Z M13.5 6.5 l4 4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
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
