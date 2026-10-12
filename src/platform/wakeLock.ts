/**
 * 走行中に画面がスリープしないようにする（N5）。Screen Wake Lock API がなければ何もしない。
 * タブが裏に回ると Wake Lock は自動で解除されるため、表示に戻ったときに取り直す。
 */
export interface WakeLockHandle {
  release(): void
}

interface WakeLockEnv {
  navigator?: { wakeLock?: WakeLock }
  document?: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>
}

export function keepScreenOn(env: WakeLockEnv = globalThis as WakeLockEnv): WakeLockHandle {
  const wakeLock = env.navigator?.wakeLock
  const doc = env.document
  if (!wakeLock) return { release() {} }

  let sentinel: WakeLockSentinel | null = null
  let released = false

  const acquire = () => {
    if (released || sentinel || doc?.visibilityState === 'hidden') return
    wakeLock
      .request('screen')
      .then((s) => {
        if (released) {
          void s.release()
          return
        }
        sentinel = s
        s.addEventListener('release', () => {
          if (sentinel === s) sentinel = null
        })
      })
      .catch((e: unknown) => console.warn('画面のスリープ防止を有効にできませんでした', e))
  }
  const onVisibility = () => {
    if (doc?.visibilityState === 'visible') acquire()
  }

  doc?.addEventListener('visibilitychange', onVisibility)
  acquire()

  return {
    release() {
      released = true
      doc?.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release()
      sentinel = null
    },
  }
}
