/**
 * 地図スタイル。タイル提供元は要検討事項 Q3 で未決のため、当面は登録・キー不要の OpenFreeMap を使い、
 * VITE_MAP_STYLE_URL で差し替えられるようにする。
 */
export const MAP_STYLE_URL =
  import.meta.env.VITE_MAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/liberty'

/** MapTiler の衛星画像＋地名のスタイル（API キーが設定されていれば 3D 地形ビューで使う） */
export function satelliteStyleUrl(maptilerKey: string): string {
  return `https://api.maptiler.com/maps/hybrid/style.json?key=${encodeURIComponent(maptilerKey)}`
}

/**
 * 3D 地形の標高タイル。AWS Open Data の Terrain Tiles（Mapzen 由来、Terrarium 形式、キー不要）。
 * 出典の表示が必要（SRTM・GMTED2010・ETOPO1 等の合成。docs/04-external-services.md）
 */
export const TERRAIN_TILES =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
export const TERRAIN_MAX_ZOOM = 15
export const TERRAIN_ATTRIBUTION =
  '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Terrain Tiles (Mapzen, SRTM, GMTED2010, ETOPO1 ほか)</a>'
