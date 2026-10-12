import { describe, expect, it } from 'vitest'
import { readFixture } from '../../../test/helpers/fixtures.ts'
import { Course } from './Course.ts'
import { importRoute } from './importRoute.ts'
import { reversedProfile } from './reverse.ts'

describe('reversedProfile', () => {
  const route = importRoute(readFixture('synthetic-lacets.gpx'), 'x')
  const reversed = reversedProfile(route.points, route.elevationSource)

  it('距離は同じで、獲得標高と下りが入れ替わる', () => {
    expect(reversed.stats.distanceM).toBeCloseTo(route.stats.distanceM, 0)
    expect(reversed.stats.ascentM).toBeCloseTo(route.stats.descentM, 0)
    expect(reversed.stats.descentM).toBeCloseTo(route.stats.ascentM, 0)
    expect(reversed.stats.minGrade).toBeCloseTo(-route.stats.maxGrade, 2)
  })

  it('始点と終点が入れ替わり、同じ地点の勾配は符号が逆', () => {
    const fwd = new Course(route.profile)
    const rev = new Course(reversed.profile)
    const total = fwd.distanceM
    expect(rev.positionAt(0).lat).toBeCloseTo(fwd.positionAt(total).lat, 6)
    expect(rev.gradeAt(3000)).toBeCloseTo(-fwd.gradeAt(total - 3000), 2)
  })
})
