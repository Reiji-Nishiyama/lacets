/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** MapLibre のスタイル URL（未指定なら OpenFreeMap） */
  readonly VITE_MAP_STYLE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
