/**
 * BLE 通信の抽象化（docs/02-architecture.md §11）。
 * Web Bluetooth（Chrome / Edge / Bluefy）と Capacitor（iOS ネイティブ, M7）を差し替え可能にする。
 * サービス・キャラクタリスティックは 16bit UUID の数値で指定する。
 */

/** トランスポートが払い出すデバイスの参照。中身はトランスポート実装が解釈する。 */
export interface BleDeviceRef {
  readonly id: string
  readonly name?: string
}

export interface RequestDeviceOptions {
  /** いずれかのサービスを持つデバイスを選択対象にする */
  services: number[]
  optionalServices?: number[]
}

export interface BleTransport {
  /** デバイス選択ダイアログを出す。Web Bluetooth ではユーザー操作の中から呼ぶ必要がある */
  requestDevice(opts: RequestDeviceOptions): Promise<BleDeviceRef>
  connect(dev: BleDeviceRef): Promise<void>
  disconnect(dev: BleDeviceRef): Promise<void>
  read(dev: BleDeviceRef, service: number, char: number): Promise<DataView>
  /** 応答付き書き込み */
  write(dev: BleDeviceRef, service: number, char: number, value: Uint8Array): Promise<void>
  /** notify / indicate を購読する。戻り値で購読解除 */
  subscribe(
    dev: BleDeviceRef,
    service: number,
    char: number,
    cb: (v: DataView) => void,
  ): Promise<() => void>
  /** 切断（意図的な切断を含む）を通知する。戻り値で登録解除 */
  onDisconnected(dev: BleDeviceRef, cb: () => void): () => void
}

/** 対象のキャラクタリスティックが存在しないことを示すエラー。任意機能の判定に使う */
export class BleNotFoundError extends Error {
  override name = 'BleNotFoundError'
}
