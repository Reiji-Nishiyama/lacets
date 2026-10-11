/**
 * ブラウザ固有 API の機能検出。アプリの他の場所からはブラウザ API を直接判定せず、ここを経由する。
 */

export interface PlatformFeatures {
  /** Web Bluetooth（Chrome / Edge / Bluefy）。Safari は非対応 */
  webBluetooth: boolean
  /** Screen Wake Lock API */
  wakeLock: boolean
  /** File System Access API（iPad は非対応） */
  fileSystemAccess: boolean
  /** Origin Private File System */
  opfs: boolean
}

interface FeatureEnv {
  navigator?: Partial<Navigator>
  showOpenFilePicker?: unknown
}

export function detectFeatures(env: FeatureEnv = globalThis as FeatureEnv): PlatformFeatures {
  const nav = env.navigator
  return {
    webBluetooth: !!nav && 'bluetooth' in nav && !!nav.bluetooth,
    wakeLock: !!nav && 'wakeLock' in nav,
    fileSystemAccess: typeof env.showOpenFilePicker === 'function',
    opfs: typeof nav?.storage?.getDirectory === 'function',
  }
}
