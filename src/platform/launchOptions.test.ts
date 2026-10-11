import { describe, expect, it } from 'vitest'
import { parseLaunchOptions } from './launchOptions.ts'

describe('parseLaunchOptions', () => {
  it.each([
    ['', false],
    ['?sim=1', true],
    ['?sim', true],
    ['?sim=0', false],
    ['?sim=false', false],
    ['?foo=1&sim=1', true],
  ])('%s → simulator=%s', (search, simulator) => {
    expect(parseLaunchOptions(search).simulator).toBe(simulator)
  })
})
