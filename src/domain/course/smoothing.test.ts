import { describe, expect, it } from 'vitest'
import { localLinearSmooth, medianFilter } from './smoothing.ts'

describe('medianFilter', () => {
  it('スパイクを除く（端は窓を対称に縮める）', () => {
    expect(medianFilter([1, 2, 100, 4, 5], 1)).toEqual([1, 2, 4, 5, 5])
  })

  it('窓 0 は元の値', () => {
    expect(medianFilter([1, 2], 0)).toEqual([1, 2])
  })
})

describe('localLinearSmooth', () => {
  it('内部では移動平均と一致する', () => {
    const v = [5, 1, 9, 3, 7, 2, 8]
    const out = localLinearSmooth(v, 1)
    for (let i = 1; i < v.length - 1; i++) {
      expect(out[i]).toBeCloseTo((v[i - 1]! + v[i]! + v[i + 1]!) / 3)
    }
  })

  it('直線は端を含めて変わらない', () => {
    const line = Array.from({ length: 20 }, (_, i) => 3 + i * 2)
    const out = localLinearSmooth(line, 4)
    for (let i = 0; i < 20; i++) expect(out[i]).toBeCloseTo(line[i]!)
  })

  it('端でもノイズを均す', () => {
    const noisy = Array.from({ length: 30 }, (_, i) => i + (i % 2 ? 1 : -1))
    const out = localLinearSmooth(noisy, 5)
    expect(Math.abs(out[0]! - 0)).toBeLessThan(0.5)
    expect(Math.abs(out[29]! - 29)).toBeLessThan(0.5)
  })

  it('窓 0 は元の値', () => {
    expect(localLinearSmooth([1, 2, 3], 0)).toEqual([1, 2, 3])
  })
})
