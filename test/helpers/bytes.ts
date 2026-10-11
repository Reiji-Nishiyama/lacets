/** バイト配列から DataView を作るテスト用ヘルパー。 */
export function dv(...bytes: number[]): DataView {
  return new DataView(Uint8Array.from(bytes).buffer)
}

export function hex(bytes: Uint8Array): number[] {
  return Array.from(bytes)
}
