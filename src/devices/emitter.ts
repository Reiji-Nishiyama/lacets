export type Unsubscribe = () => void

/** 型付きの簡易イベント発行器。リスナー内の例外は他のリスナーに波及させない。 */
export class Emitter<T> {
  private readonly listeners = new Set<(value: T) => void>()

  on(listener: (value: T) => void): Unsubscribe {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(value: T): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(value)
      } catch (e) {
        console.error(e)
      }
    }
  }

  clear(): void {
    this.listeners.clear()
  }
}
