import { Course } from '../../src/domain/course/Course.ts'
import type { ProfilePoint } from '../../src/domain/course/types.ts'
import type { ReferenceSample } from '../../src/domain/ghost/types.ts'
import { DEFAULT_PHYSICS, advance } from '../../src/domain/physics/model.ts'

/** 決定的な疑似乱数（テストの再現性のため） */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

const M_PER_DEG = (6_371_008.8 * Math.PI) / 180

/**
 * プロファイルを一定パワーで物理モデルで走らせた「実走記録」を作る。
 * GPS の揺れ（±gpsNoiseM）、スタート前の待機、ゴール後に同じ道を下る区間を含められる。
 * 戻り値の trueTimeAt(d) は待機を除いた本当の到達時刻。
 */
export function simulatedReference(
  profile: readonly ProfilePoint[],
  opts: { powerW: number; waitS?: number; descentS?: number; gpsNoiseM?: number; seed?: number },
) {
  const course = new Course(profile)
  const physics = { ...DEFAULT_PHYSICS, totalMassKg: 75, cdaM2: 0.36, crr: 0.004 }
  const random = rng(opts.seed ?? 1)
  const noise = opts.gpsNoiseM ?? 3
  const samples: ReferenceSample[] = []
  const truth: { distanceM: number; timeS: number }[] = []
  const at = (timeS: number, distanceM: number) => {
    const p = course.positionAt(distanceM)
    const jitter = () => (random() * 2 - 1) * noise
    samples.push({
      timeS,
      lat: p.lat + jitter() / M_PER_DEG,
      lon: p.lon + jitter() / (M_PER_DEG * Math.cos((p.lat * Math.PI) / 180)),
      elevationM: p.elevationM,
      powerW: opts.powerW,
    })
  }
  let t = 0
  for (; t < (opts.waitS ?? 0); t++) at(t, 0)
  const startT = t
  let state = { speedMps: 0, distanceM: 0 }
  while (state.distanceM < course.distanceM) {
    truth.push({ distanceM: state.distanceM, timeS: t - startT })
    at(t, state.distanceM)
    state = advance(state, opts.powerW, course.gradeAt(state.distanceM), 1, physics)
    t++
  }
  at(t, course.distanceM)
  truth.push({ distanceM: course.distanceM, timeS: t - startT })
  // ゴール後に同じ道を 12 m/s で下る
  for (let i = 1; i <= (opts.descentS ?? 0); i++) at(t + i, Math.max(0, course.distanceM - 12 * i))

  const trueTimeAt = (d: number) => {
    const i = truth.findIndex((x) => x.distanceM >= d)
    if (i <= 0) return 0
    const a = truth[i - 1]!
    const b = truth[i]!
    return a.timeS + ((d - a.distanceM) / (b.distanceM - a.distanceM)) * (b.timeS - a.timeS)
  }
  return { samples, trueTimeAt, durationS: t - startT }
}
