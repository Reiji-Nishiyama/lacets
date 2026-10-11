import { describe, expect, it } from 'vitest'
import { Course } from './Course.ts'
import type { ProfilePoint } from './types.ts'

const profile: ProfilePoint[] = [
  { distanceM: 0, lat: 45, lon: 6, elevationM: 100, grade: 0 },
  { distanceM: 10, lat: 45.0001, lon: 6, elevationM: 100.5, grade: 0.1 },
  { distanceM: 20, lat: 45.0002, lon: 6, elevationM: 101.5, grade: 0.2 },
  { distanceM: 25, lat: 45.0002, lon: 6.0001, elevationM: 102, grade: 0.1 },
]

describe('Course', () => {
  const course = new Course(profile)

  it('距離で勾配を線形補間する', () => {
    expect(course.distanceM).toBe(25)
    expect(course.gradeAt(0)).toBe(0)
    expect(course.gradeAt(5)).toBeCloseTo(0.05)
    expect(course.gradeAt(15)).toBeCloseTo(0.15)
    expect(course.gradeAt(22.5)).toBeCloseTo(0.15)
  })

  it('範囲外は端にクランプする', () => {
    expect(course.gradeAt(-10)).toBe(0)
    expect(course.gradeAt(1000)).toBeCloseTo(0.1)
    expect(course.positionAt(1000).distanceM).toBe(25)
  })

  it('位置・標高・進行方向', () => {
    const p = course.positionAt(15)
    expect(p.lat).toBeCloseTo(45.00015, 8)
    expect(p.elevationM).toBeCloseTo(101)
    expect(p.headingDeg).toBeCloseTo(0)
    expect(course.positionAt(22).headingDeg).toBeCloseTo(90, 0)
  })

  it('2 点未満はエラー', () => {
    expect(() => new Course([profile[0]!])).toThrow()
  })
})
