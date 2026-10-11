import { describe, expect, it } from 'vitest'
import { t } from './index.ts'

describe('t', () => {
  it('文言を返す', () => {
    expect(t('app.name')).toBe('Lacets')
  })

  it('パラメータを置換する', () => {
    expect(t('grade.range', { min: -10, max: 20 })).toBe('送信範囲 -10% 〜 20%')
    expect(t('error.connectFailed')).toContain('{detail}')
  })
})
