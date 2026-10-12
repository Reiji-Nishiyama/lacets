import { useEffect, useRef, useState, type RefObject } from 'react'
import { panoCenterFraction, type StreetImage } from '../../domain/media/streetImages.ts'
import { t } from '../i18n/index.ts'

/** パノラマを切り出して見せる水平方向の視野 [deg] */
const PANO_FOV_DEG = 100

/**
 * 路上画像を表示する（docs/02 §9）。画像が変わったらクロスフェードし、先の画像を先読みする。
 * パノラマ（正距円筒図法）は進行方向 headingDeg を中央に、視野 100° 分を切り出す。
 */
export function StreetImageView({
  image,
  headingDeg,
  preload,
}: {
  image: StreetImage
  headingDeg: number
  preload: readonly StreetImage[]
}) {
  // 画像が変わったら前の画像を下に残し、新しい画像をフェードインさせる（終わったら前の画像を外す）
  const [shown, setShown] = useState(image)
  const [previous, setPrevious] = useState<StreetImage | null>(null)
  if (shown.provider !== image.provider || shown.id !== image.id) {
    setPrevious(shown)
    setShown(image)
  }
  const containerRef = useRef<HTMLDivElement>(null)
  const size = useSize(containerRef)

  useEffect(() => {
    for (const p of preload) new Image().src = p.imageUrl
  }, [preload])

  return (
    <div className="street-image" ref={containerRef} data-testid="street-image">
      {previous && (
        <ImageLayer
          key={`${previous.provider}:${previous.id}`}
          image={previous}
          headingDeg={headingDeg}
          size={size}
        />
      )}
      <ImageLayer
        key={`${shown.provider}:${shown.id}`}
        image={shown}
        headingDeg={headingDeg}
        size={size}
        onFadeEnd={previous ? () => setPrevious(null) : undefined}
      />
      <Credit image={image} />
    </div>
  )
}

function ImageLayer({
  image,
  headingDeg,
  size,
  onFadeEnd,
}: {
  image: StreetImage
  headingDeg: number
  size: { width: number; height: number }
  /** あればフェードインし、終わったら呼ぶ */
  onFadeEnd?: () => void
}) {
  const className = `street-image-layer${onFadeEnd ? ' fade-in' : ''}`
  if (!image.isPano) {
    return (
      <img
        className={className}
        src={image.imageUrl}
        alt=""
        draggable={false}
        onAnimationEnd={onFadeEnd}
      />
    )
  }
  // 画面の幅が視野 100° になるよう拡大する。正距円筒図法は幅:高さ = 2:1
  const panoWidth = (size.width * 360) / PANO_FOV_DEG
  const center = panoCenterFraction(image.azimuthDeg, headingDeg)
  return (
    <div
      className={`${className} street-image-pano`}
      style={{
        backgroundImage: `url("${image.imageUrl}")`,
        backgroundSize: `${panoWidth}px ${panoWidth / 2}px`,
        backgroundPosition: `${size.width / 2 - center * panoWidth}px center`,
      }}
      onAnimationEnd={onFadeEnd}
    />
  )
}

function Credit({ image }: { image: StreetImage }) {
  const provider = t(`visual.provider.${image.provider}`)
  const license = image.license ?? '—'
  return (
    <div className="street-image-credit" data-testid="street-image-credit">
      {image.creator
        ? t('visual.credit', { creator: image.creator, provider, license })
        : t('visual.creditNoCreator', { provider, license })}
    </div>
  )
}

function useSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return size
}
