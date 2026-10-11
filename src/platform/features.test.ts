import { describe, expect, it } from 'vitest'
import { detectFeatures } from './features.ts'

describe('detectFeatures', () => {
  it('何もない環境ではすべて false', () => {
    expect(detectFeatures({})).toEqual({
      webBluetooth: false,
      wakeLock: false,
      fileSystemAccess: false,
      opfs: false,
    })
  })

  it('Chrome 相当の環境', () => {
    const env = {
      navigator: {
        bluetooth: {} as Bluetooth,
        wakeLock: {} as WakeLock,
        storage: { getDirectory: () => Promise.resolve({}) } as unknown as StorageManager,
      },
      showOpenFilePicker: () => {},
    }
    expect(detectFeatures(env)).toEqual({
      webBluetooth: true,
      wakeLock: true,
      fileSystemAccess: true,
      opfs: true,
    })
  })
})
