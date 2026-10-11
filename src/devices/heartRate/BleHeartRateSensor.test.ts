import { describe, expect, it } from 'vitest'
import { FakeBleTransport } from '../../../test/helpers/FakeBleTransport.ts'
import { HEART_RATE_MEASUREMENT, HEART_RATE_SERVICE } from '../ble/uuids.ts'
import type { HeartRateData } from '../HeartRateSensor.ts'
import { BleHeartRateSensor } from './BleHeartRateSensor.ts'

describe('BleHeartRateSensor', () => {
  it('Heart Rate Measurement を購読して心拍を通知する', async () => {
    const t = new FakeBleTransport()
    t.addCharacteristic(HEART_RATE_SERVICE, HEART_RATE_MEASUREMENT)
    const sensor = new BleHeartRateSensor(t, () => 42)
    const received: HeartRateData[] = []
    sensor.onData((d) => received.push(d))
    await sensor.connect()
    t.notify(HEART_RATE_SERVICE, HEART_RATE_MEASUREMENT, [0x00, 0x8c])
    expect(sensor.state).toBe('connected')
    expect(received).toEqual([{ heartRateBpm: 140, timestampMs: 42 }])
  })
})
