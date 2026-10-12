import { describe, expect, it } from 'vitest'
import { Course } from '../course/Course.ts'
import { GradeThrottle, trainerGrade } from './gradeCommand.ts'

const course = new Course([
  { distanceM: 0, lat: 45, lon: 6, elevationM: 0, grade: 0 },
  { distanceM: 100, lat: 45.001, lon: 6, elevationM: 5, grade: 0.1 },
])

describe('trainerGrade', () => {
  it('lookahead 秒先の勾配に難易度を掛ける', () => {
    expect(trainerGrade(course, 50, 0, 1)).toBeCloseTo(0.05)
    expect(trainerGrade(course, 50, 10, 1)).toBeCloseTo(0.06) // 1 秒先 = 60 m
    expect(trainerGrade(course, 50, 10, 0.5)).toBeCloseTo(0.03)
    expect(trainerGrade(course, 50, 10, 1, 2)).toBeCloseTo(0.07)
  })
})

describe('GradeThrottle', () => {
  it('初回は送る。0.1% 未満の変化は 1 秒間送らない', () => {
    const th = new GradeThrottle()
    expect(th.shouldSend(0.05, 0)).toBe(true)
    expect(th.shouldSend(0.0505, 250)).toBe(false)
    expect(th.shouldSend(0.0509, 500)).toBe(false)
    expect(th.shouldSend(0.0509, 1000)).toBe(true) // 1 秒経過
  })

  it('0.1% 以上の変化はすぐ送る', () => {
    const th = new GradeThrottle()
    th.shouldSend(0.05, 0)
    expect(th.shouldSend(0.051, 250)).toBe(true)
    expect(th.shouldSend(0.049, 500)).toBe(true)
  })

  it('reset 後は次を必ず送る', () => {
    const th = new GradeThrottle()
    th.shouldSend(0.05, 0)
    th.reset()
    expect(th.shouldSend(0.05, 10)).toBe(true)
  })
})
