import { describe, expect, it } from 'vitest'
import { sampleRide } from '../../test/helpers/recordedRide.ts'
import type { RecordedRide } from '../recording/types.ts'
import { personalBestRideIds } from './personalBests.ts'

/** sampleRide は 450 m を 90 秒。timeScale で速さを変える */
function ride(id: string, patch: Partial<RecordedRide> = {}, timeScale = 1): RecordedRide {
  const base = sampleRide()
  return {
    ...base,
    id,
    samples: base.samples.map((s) => ({ ...s, elapsedS: s.elapsedS * timeScale })),
    ...patch,
  }
}

describe('personalBestRideIds', () => {
  const routes = [
    { id: 'route-1', stats: { distanceM: 450, ascentM: 0, descentM: 0, maxGrade: 0, minGrade: 0 } },
  ]

  it('ルート・向きごとに、走り切った記録のうちいちばん速いもの', () => {
    const slow = ride('slow')
    const fast = ride('fast', {}, 0.5)
    // 途中から走った記録は、速くても対象にしない
    const partial = ride(
      'partial',
      { startDistanceM: 200, samples: sampleRide().samples.filter((s) => s.distanceM >= 200) },
      0.1,
    )
    const reversed = ride('reversed', { reversed: true }, 1.2)
    const deletedRoute = ride('deleted', { routeId: 'gone' }, 0.1)
    const ids = personalBestRideIds([slow, fast, partial, reversed, deletedRoute], routes)
    expect([...ids].sort()).toEqual(['fast', 'reversed'])
  })
})
