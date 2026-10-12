/** 勾配の色分け（登りの強さ）。CSS 変数を参照する */
export function gradeColor(grade: number): string {
  if (grade < 0.03) return 'var(--grade-0)'
  if (grade < 0.06) return 'var(--grade-1)'
  if (grade < 0.09) return 'var(--grade-2)'
  if (grade < 0.12) return 'var(--grade-3)'
  return 'var(--grade-4)'
}
