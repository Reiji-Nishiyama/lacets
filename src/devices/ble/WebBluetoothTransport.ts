import { BleNotFoundError, type BleDeviceRef, type BleTransport } from './BleTransport.ts'

/** Web Bluetooth（Chrome / Edge / Bluefy）による BleTransport 実装。 */
export class WebBluetoothTransport implements BleTransport {
  private readonly devices = new Map<string, BluetoothDevice>()
  private readonly chars = new Map<string, BluetoothRemoteGATTCharacteristic>()

  private readonly bluetooth: Bluetooth

  constructor(bluetooth: Bluetooth = navigator.bluetooth) {
    this.bluetooth = bluetooth
  }

  async requestDevice(opts: { services: number[]; optionalServices?: number[] }) {
    const device = await this.bluetooth.requestDevice({
      filters: opts.services.map((s) => ({ services: [s] })),
      optionalServices: opts.optionalServices,
    })
    this.devices.set(device.id, device)
    return { id: device.id, name: device.name ?? undefined }
  }

  async connect(dev: BleDeviceRef): Promise<void> {
    const device = this.device(dev)
    this.clearCharCache(dev)
    if (!device.gatt) throw new Error('GATT サーバーがありません')
    await device.gatt.connect()
  }

  async disconnect(dev: BleDeviceRef): Promise<void> {
    this.clearCharCache(dev)
    this.device(dev).gatt?.disconnect()
  }

  async read(dev: BleDeviceRef, service: number, char: number): Promise<DataView> {
    return (await this.characteristic(dev, service, char)).readValue()
  }

  async write(dev: BleDeviceRef, service: number, char: number, value: Uint8Array) {
    const c = await this.characteristic(dev, service, char)
    // BufferSource として渡すため ArrayBuffer 背景のコピーを作る
    await c.writeValueWithResponse(new Uint8Array(value))
  }

  async subscribe(
    dev: BleDeviceRef,
    service: number,
    char: number,
    cb: (v: DataView) => void,
  ): Promise<() => void> {
    const c = await this.characteristic(dev, service, char)
    const handler = () => {
      if (c.value) cb(c.value)
    }
    c.addEventListener('characteristicvaluechanged', handler)
    await c.startNotifications()
    return () => {
      c.removeEventListener('characteristicvaluechanged', handler)
      if (c.service.device.gatt?.connected) c.stopNotifications().catch(() => {})
    }
  }

  onDisconnected(dev: BleDeviceRef, cb: () => void): () => void {
    const device = this.device(dev)
    const handler = () => {
      this.clearCharCache(dev)
      cb()
    }
    device.addEventListener('gattserverdisconnected', handler)
    return () => device.removeEventListener('gattserverdisconnected', handler)
  }

  private device(dev: BleDeviceRef): BluetoothDevice {
    const device = this.devices.get(dev.id)
    if (!device) throw new Error(`未知のデバイスです: ${dev.id}`)
    return device
  }

  private async characteristic(dev: BleDeviceRef, service: number, char: number) {
    const key = `${dev.id}/${service}/${char}`
    const cached = this.chars.get(key)
    if (cached) return cached
    const gatt = this.device(dev).gatt
    if (!gatt?.connected) throw new Error('デバイスが接続されていません')
    let c: BluetoothRemoteGATTCharacteristic
    try {
      const s = await gatt.getPrimaryService(service)
      c = await s.getCharacteristic(char)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotFoundError') {
        throw new BleNotFoundError(e.message)
      }
      throw e
    }
    this.chars.set(key, c)
    return c
  }

  private clearCharCache(dev: BleDeviceRef) {
    for (const key of this.chars.keys()) {
      if (key.startsWith(`${dev.id}/`)) this.chars.delete(key)
    }
  }
}
