/** 画面上部の空と山並み（装飾）。統合案のヘッダーの帯 */
export function SkyBackdrop() {
  return (
    <div className="sky-backdrop" aria-hidden="true">
      <svg viewBox="0 0 1180 300" preserveAspectRatio="xMidYMax slice">
        <circle cx="980" cy="84" r="36" fill="var(--sun)" />
        <path
          d="M0 250 L170 130 L290 196 L470 76 L610 180 L780 104 L960 204 L1180 120 L1180 300 L0 300 Z"
          fill="var(--sky-deep)"
        />
        <path
          d="M0 284 L200 196 L360 252 L540 170 L700 236 L880 178 L1060 246 L1180 212 L1180 300 L0 300 Z"
          fill="var(--meadow)"
        />
      </svg>
    </div>
  )
}
