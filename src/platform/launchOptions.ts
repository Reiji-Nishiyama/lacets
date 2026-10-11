/** URL クエリで指定する起動オプション。 */
export interface LaunchOptions {
  /** `?sim=1` でシミュレータトレーナーを使う */
  simulator: boolean
}

export function parseLaunchOptions(search: string): LaunchOptions {
  const params = new URLSearchParams(search)
  const sim = params.get('sim')
  return { simulator: sim !== null && sim !== '0' && sim !== 'false' }
}

export function currentLaunchOptions(): LaunchOptions {
  return parseLaunchOptions(typeof location === 'undefined' ? '' : location.search)
}
