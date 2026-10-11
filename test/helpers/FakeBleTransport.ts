import {
  BleNotFoundError,
  type BleDeviceRef,
  type BleTransport,
} from '../../src/devices/ble/BleTransport.ts'

type Listener = (v: DataView) => void

const key = (service: number, char: number) => `${service}/${char}`

/**
 * 1 台の BLE ペリフェラルを模擬するテスト用トランスポート。
 * 読み取り値の設定、書き込みへの応答（onWrite）、notify の送出、予期しない切断を再現できる。
 */
export class FakeBleTransport implements BleTransport {
  readonly device: BleDeviceRef = { id: 'fake-1', name: 'Fake Device' }
  connected = false
  connectCount = 0
  /** 次の connect() を失敗させる回数 */
  failNextConnects = 0
  requestDeviceCount = 0
  readonly readValues = new Map<string, Uint8Array>()
  readonly writes: { service: number; char: number; bytes: number[] }[] = []
  onWrite: ((service: number, char: number, bytes: Uint8Array) => void) | null = null
  private readonly listeners = new Map<string, Set<Listener>>()
  private readonly disconnectListeners = new Set<() => void>()
  /** subscribe 可能なキャラクタリスティック。未登録なら BleNotFoundError */
  readonly characteristics = new Set<string>()

  addCharacteristic(service: number, char: number, value?: Uint8Array) {
    this.characteristics.add(key(service, char))
    if (value) this.readValues.set(key(service, char), value)
  }

  async requestDevice() {
    this.requestDeviceCount++
    return this.device
  }

  async connect() {
    this.connectCount++
    if (this.failNextConnects > 0) {
      this.failNextConnects--
      throw new Error('接続失敗（模擬）')
    }
    this.connected = true
  }

  async disconnect() {
    if (!this.connected) return
    this.connected = false
    this.listeners.clear()
    for (const cb of [...this.disconnectListeners]) cb()
  }

  async read(_dev: BleDeviceRef, service: number, char: number): Promise<DataView> {
    this.assertConnected()
    const v = this.readValues.get(key(service, char))
    if (!v) throw new BleNotFoundError(`not found: ${key(service, char)}`)
    return new DataView(Uint8Array.from(v).buffer)
  }

  async write(_dev: BleDeviceRef, service: number, char: number, value: Uint8Array) {
    this.assertConnected()
    this.writes.push({ service, char, bytes: Array.from(value) })
    // 応答（indicate）は書き込み完了の後に届く
    queueMicrotask(() => this.onWrite?.(service, char, value))
  }

  async subscribe(_dev: BleDeviceRef, service: number, char: number, cb: Listener) {
    this.assertConnected()
    const k = key(service, char)
    if (!this.characteristics.has(k)) throw new BleNotFoundError(`not found: ${k}`)
    let set = this.listeners.get(k)
    if (!set) this.listeners.set(k, (set = new Set()))
    set.add(cb)
    return () => {
      set.delete(cb)
    }
  }

  onDisconnected(_dev: BleDeviceRef, cb: () => void) {
    this.disconnectListeners.add(cb)
    return () => {
      this.disconnectListeners.delete(cb)
    }
  }

  /** ペリフェラルから notify / indicate を送る */
  notify(service: number, char: number, bytes: number[]) {
    const view = new DataView(Uint8Array.from(bytes).buffer)
    for (const cb of this.listeners.get(key(service, char)) ?? []) cb(view)
  }

  /** 電波断などの予期しない切断を再現する */
  drop() {
    this.connected = false
    this.listeners.clear()
    for (const cb of [...this.disconnectListeners]) cb()
  }

  writesTo(service: number, char: number): number[][] {
    return this.writes.filter((w) => w.service === service && w.char === char).map((w) => w.bytes)
  }

  private assertConnected() {
    if (!this.connected) throw new Error('not connected')
  }
}
