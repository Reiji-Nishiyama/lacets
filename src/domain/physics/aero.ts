/** 海面・15℃ の標準空気密度 [kg/m³]。将来は標高で補正する */
export const AIR_DENSITY_KG_PER_M3 = 1.225

/** 既定の転がり抵抗係数 */
export const DEFAULT_CRR = 0.004

/** 既定の CdA（ブラケットポジション）[m²] */
export const DEFAULT_CDA_M2 = 0.32

/** FTMS に送る風抵抗係数 Cw = 0.5·ρ·CdA [kg/m] */
export function cwFromCda(cdaM2: number, airDensityKgPerM3 = AIR_DENSITY_KG_PER_M3): number {
  return 0.5 * airDensityKgPerM3 * cdaM2
}
