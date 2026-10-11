import type { BleTransport } from '../ble/BleTransport.ts'
import { ManagedConnection } from '../ble/ManagedConnection.ts'
import { HEART_RATE_MEASUREMENT, HEART_RATE_SERVICE } from '../ble/uuids.ts'
import type { ConnectionState } from '../ConnectionState.ts'
import { Emitter, type Unsubscribe } from '../emitter.ts'
import type { HeartRateData, HeartRateSensor } from '../HeartRateSensor.ts'
import { decodeHeartRateMeasurement } from './protocol.ts'

/** BLE Heart Rate Service（0x180D）の心拍計。 */
export class BleHeartRateSensor implements HeartRateSensor {
  readonly kind = 'ble'
  private readonly conn: ManagedConnection
  private readonly dataEmitter = new Emitter<HeartRateData>()

  private readonly now: () => number

  constructor(transport: BleTransport, now: () => number = Date.now) {
    this.now = now
    this.conn = new ManagedConnection({
      transport,
      request: { services: [HEART_RATE_SERVICE] },
      setup: (dev) =>
        transport.subscribe(dev, HEART_RATE_SERVICE, HEART_RATE_MEASUREMENT, (v) => {
          const m = decodeHeartRateMeasurement(v)
          if (m) this.dataEmitter.emit({ heartRateBpm: m.heartRateBpm, timestampMs: this.now() })
        }),
    })
  }

  get state(): ConnectionState {
    return this.conn.state
  }

  get name(): string | undefined {
    return this.conn.deviceName
  }

  connect(): Promise<void> {
    return this.conn.connect()
  }

  disconnect(): Promise<void> {
    return this.conn.disconnect()
  }

  onData(cb: (data: HeartRateData) => void): Unsubscribe {
    return this.dataEmitter.on(cb)
  }

  onStateChange(cb: (state: ConnectionState) => void): Unsubscribe {
    return this.conn.onStateChange(cb)
  }
}
