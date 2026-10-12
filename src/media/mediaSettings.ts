/** 地図・路上画像の設定。キーやトークンは端末内にだけ保存する */
export interface MediaSettings {
  /** Panoramax の路上画像を使う（キー不要） */
  panoramaxEnabled: boolean
  /** Mapillary のクライアントトークン（空なら使わない） */
  mapillaryToken: string
  /** MapTiler の API キー（あれば 3D 地形ビューに衛星画像を使う） */
  maptilerKey: string
}

export const DEFAULT_MEDIA_SETTINGS: MediaSettings = {
  panoramaxEnabled: true,
  mapillaryToken: '',
  maptilerKey: '',
}
