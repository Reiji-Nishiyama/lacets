/**
 * ファイルを端末に保存する。File System Access API（Chrome / Edge の PC）があれば保存ダイアログ、
 * なければ（iPad 等）ダウンロードリンクで保存する。M7 で Capacitor Filesystem に対応する。
 */

export type SaveResult = 'saved' | 'cancelled'

interface SaveFilePickerWindow {
  showSaveFilePicker?: (opts: {
    suggestedName: string
    types?: { description: string; accept: Record<string, string[]> }[]
  }) => Promise<FileSystemFileHandle>
}

export async function saveFile(
  fileName: string,
  bytes: Uint8Array,
  mimeType: string,
  description: string,
): Promise<SaveResult> {
  const w = globalThis as unknown as SaveFilePickerWindow
  const ext = fileName.slice(fileName.lastIndexOf('.'))
  if (typeof w.showSaveFilePicker === 'function') {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description, accept: { [mimeType]: [ext] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(new Uint8Array(bytes))
      await writable.close()
      return 'saved'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      throw e
    }
  }
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mimeType }))
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
  } finally {
    // クリック直後に解放するとダウンロードが始まらないブラウザがあるため遅らせる
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
  return 'saved'
}
