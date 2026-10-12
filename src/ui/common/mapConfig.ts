/**
 * 地図スタイル。タイル提供元は要検討事項 Q3 で未決のため、当面は登録・キー不要の OpenFreeMap を使い、
 * VITE_MAP_STYLE_URL で差し替えられるようにする。
 */
export const MAP_STYLE_URL =
  import.meta.env.VITE_MAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/liberty'
