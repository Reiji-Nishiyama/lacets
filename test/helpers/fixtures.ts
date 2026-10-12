import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** test/fixtures 以下のファイルを読む */
export function readFixture(name: string): Uint8Array {
  return new Uint8Array(
    readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url))),
  )
}
